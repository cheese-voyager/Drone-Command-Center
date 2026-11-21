"""Baca data dari Pixhawk (MAVLink) di background dan rangkum jadi status drone."""
import copy
import math
import threading
import time
from collections import deque
from datetime import datetime, timezone
from typing import Any

from app.core.constants import (
    MAV_STATUS_MESSAGE_HISTORY,
    MAVLINK_RECONNECT_DELAY_S,
    MAVLINK_RECV_TIMEOUT_S,
    MAVLINK_STREAM_RATE_HZ,
    MOTOR_COUNT,
    MOTOR_PWM_MAX,
    MOTOR_PWM_MIN,
    ROLLING_WINDOW,
    SYS_STATUS_CURRENT_UNKNOWN,
    SYS_STATUS_VOLTAGE_UNKNOWN,
)
from app.core.exceptions import DroneNotConnectedError, MavlinkCommandError
from app.core.logger import get_logger
from app.schemas.status import DroneStatus
from app.services.battery_service import BatteryService
from app.services.mavlink_client import (
    MAV_AUTOPILOT_INVALID,
    MAV_CMD_DO_MOTOR_TEST,
    MAV_CMD_DO_SET_SERVO,
    MAV_MODE_FLAG_SAFETY_ARMED,
    MAV_POWER_STATUS_BRICK_VALID,
    MAV_POWER_STATUS_USB_CONNECTED,
    MAV_RESULT_LABELS,
    MAV_TYPE_GCS,
    MavlinkFactory,
    MavlinkLink,
)
from app.services.seed_service import SeedService

log = get_logger("drone")


def _empty_telemetry() -> dict:
    return {
        "connected": False,
        "mode": None,
        "armed": False,
        "lat": None,
        "lon": None,
        "alt": None,
        "pitch": None,
        "roll": None,
        "yaw": None,
        "speed": None,
        "voltage": None,
        "current": None,
        "gps_fix": None,
        "satellites": None,
        "motors": None,
        "time": {"boot_ms": None},
        "power": {},
        "gps": {},
        "nav": {},
        "mission": {},
        "health": {},
        "link": {},
        "servo": {"channels": [], "last_drop": None},
    }


class DroneService:
    def __init__(
        self,
        connection: str,
        link_factory: MavlinkFactory,
        battery: BatteryService,
        seeds: SeedService,
        *,
        stream_rate_hz: int = MAVLINK_STREAM_RATE_HZ,
        recv_timeout_s: float = MAVLINK_RECV_TIMEOUT_S,
        reconnect_delay_s: float = MAVLINK_RECONNECT_DELAY_S,
    ):
        self.connection = connection  # contoh: "udpin:127.0.0.1:14551"
        self._link_factory = link_factory
        self._battery = battery
        self._seeds = seeds
        self._stream_rate_hz = stream_rate_hz
        self._recv_timeout_s = recv_timeout_s
        self._reconnect_delay_s = reconnect_delay_s

        self._lock = threading.RLock()
        self._data = _empty_telemetry()
        self._speeds: deque[float] = deque(maxlen=ROLLING_WINDOW)
        # jenis pesan -> [jumlah, waktu terakhir (monotonic)]; untuk diagnostik /debug/mavlink
        self._msg_stats: dict[str, list] = {}
        self._messages: deque[dict] = deque(maxlen=MAV_STATUS_MESSAGE_HISTORY)
        self._last_servo_command: dict | None = None
        self._last_update = datetime.now(timezone.utc)
        self._started_at = time.monotonic()
        self._link: MavlinkLink | None = None
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # ---------- Hidup-mati ----------
    def start(self) -> None:
        """Mulai baca data Pixhawk di background."""
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._read_loop, name="mavlink-reader", daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 3.0) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout)
            self._thread = None
        self._detach_link()

    def _read_loop(self) -> None:
        while not self._stop.is_set():
            link = None
            try:
                log.info("Menghubungkan ke Pixhawk: %s", self.connection)
                link = self._link_factory(self.connection)
                if not link.connect(self._stop.is_set):
                    break  # dihentikan saat masih menunggu heartbeat
                link.request_streams(self._stream_rate_hz)  # minta data 5x per detik
                self.attach_link(link)
                log.info("Pixhawk terhubung!")

                while not self._stop.is_set():
                    msg = link.recv(self._recv_timeout_s)
                    if msg is None:
                        self._mark_disconnected()
                        continue
                    self.handle_message(msg)
            except Exception:
                log.exception("Error MAVLink")
            finally:
                self._detach_link(link)
            if self._stop.wait(self._reconnect_delay_s):
                break

    def attach_link(self, link: MavlinkLink) -> None:
        with self._lock:
            self._link = link

    def _detach_link(self, link: MavlinkLink | None = None) -> None:
        with self._lock:
            current = self._link
            self._link = None
            self._data["connected"] = False
            self._data["time"] = {"boot_ms": None}
            self._data["power"] = {}
            self._data["gps"] = {}
            self._data["nav"] = {}
            self._data["mission"] = {}
            self._data["health"] = {}
            self._data["link"] = {}
            self._data["servo"] = {"channels": [], "last_drop": None}
            self._messages.clear()
            self._last_servo_command = None
        self._battery.pause()
        for item in {id(x): x for x in (link, current) if x is not None}.values():
            try:
                item.close()
            except Exception:
                pass

    def _mark_disconnected(self) -> None:
        with self._lock:
            self._data["connected"] = False
        self._battery.pause()

    # ---------- Status koneksi ----------
    @property
    def is_connected(self) -> bool:
        with self._lock:
            return bool(self._data["connected"])

    @property
    def is_armed(self) -> bool:
        with self._lock:
            return bool(self._data["armed"])

    @property
    def has_link(self) -> bool:
        with self._lock:
            return self._link is not None

    def position(self) -> tuple[float | None, float | None]:
        with self._lock:
            return self._data["lat"], self._data["lon"]

    # ---------- Pesan MAVLink ----------
    def handle_message(self, msg: Any) -> None:
        """Perbarui data terbaru dari satu pesan MAVLink. Pesan apa pun berarti terhubung."""
        kind = msg.get_type()
        amps = None

        with self._lock:
            self._data["connected"] = True
            self._last_update = datetime.now(timezone.utc)
            d = self._data
            stat = self._msg_stats.setdefault(kind, [0, 0.0])
            stat[0] += 1
            stat[1] = time.monotonic()

            if kind == "HEARTBEAT":
                if self._is_vehicle_heartbeat(msg):
                    d["mode"] = getattr(self._link, "flightmode", None)
                    d["armed"] = bool(msg.base_mode & MAV_MODE_FLAG_SAFETY_ARMED)

            elif kind == "GLOBAL_POSITION_INT":
                boot_ms = getattr(msg, "time_boot_ms", None)
                if boot_ms is not None:
                    d["time"]["boot_ms"] = int(boot_ms)
                if msg.lat == 0 and msg.lon == 0:
                    # Pixhawk mengirim 0,0 selama belum ada GPS fix: itu bukan posisi sungguhan
                    d["lat"] = None
                    d["lon"] = None
                else:
                    d["lat"] = msg.lat / 1e7
                    d["lon"] = msg.lon / 1e7
                d["alt"] = msg.relative_alt / 1000  # meter
                nav = d["nav"]
                nav["alt_rel_m"] = msg.relative_alt / 1000
                alt_msl = getattr(msg, "alt", None)
                if alt_msl is not None:
                    nav["alt_amsl_m"] = alt_msl / 1000
                for axis in ("vx", "vy", "vz"):
                    value = getattr(msg, axis, None)
                    if value is not None:
                        nav[f"{axis}_mps"] = value / 100
                hdg = getattr(msg, "hdg", None)
                if hdg is not None and hdg != 65535:
                    nav["cog_deg"] = round(hdg / 100, 1)

            elif kind == "ATTITUDE":
                d["pitch"] = math.degrees(msg.pitch)
                d["roll"] = math.degrees(msg.roll)
                d["yaw"] = math.degrees(msg.yaw) % 360
                d["nav"]["heading_deg"] = d["yaw"]

            elif kind == "VFR_HUD":
                d["speed"] = msg.groundspeed
                self._speeds.append(msg.groundspeed)
                d["nav"].update(
                    {
                        "airspeed_mps": getattr(msg, "airspeed", None),
                        "groundspeed_mps": msg.groundspeed,
                        "climb_mps": getattr(msg, "climb", None),
                        "throttle_percent": getattr(msg, "throttle", None),
                    }
                )
                heading = getattr(msg, "heading", None)
                if heading is not None:
                    d["nav"]["heading_deg"] = float(heading)

            elif kind == "GPS_RAW_INT":
                d["gps_fix"] = msg.fix_type
                d["satellites"] = msg.satellites_visible
                fix_type = int(msg.fix_type)
                gps = d["gps"]
                gps["fix_type"] = fix_type
                gps["satellites_visible"] = msg.satellites_visible
                gps["rtk_status"] = (
                    "fixed" if fix_type == 6 else "float" if fix_type == 5 else "none"
                )
                for key, attr, scale in (
                    ("hdop", "eph", 100),
                    ("vdop", "epv", 100),
                    ("alt_msl_m", "alt", 1000),
                    ("speed_mps", "vel", 100),
                ):
                    value = getattr(msg, attr, None)
                    if value is None:
                        continue
                    if attr in ("eph", "epv") and value in (0, 65535):
                        continue
                    gps[key] = value / scale
                cog = getattr(msg, "cog", None)
                if cog is not None and cog != 65535:
                    gps["cog_deg"] = round(cog / 100, 1)
                    d["nav"]["cog_deg"] = gps["cog_deg"]

            elif kind == "SERVO_OUTPUT_RAW":
                d["motors"] = self._read_motors(msg)
                d["servo"]["channels"] = self._read_servo_channels(msg)

            elif kind == "COMMAND_ACK":
                if msg.command == MAV_CMD_DO_MOTOR_TEST and msg.result != 0:
                    log.warning("Pixhawk MENOLAK tes motor (kode hasil %s)", msg.result)
                if msg.command == MAV_CMD_DO_SET_SERVO and self._last_servo_command is not None:
                    d["servo"]["last_drop"] = {
                        **self._last_servo_command,
                        "ack_result": MAV_RESULT_LABELS.get(
                            int(getattr(msg, "result", -1)), "UNKNOWN"
                        ),
                    }

            elif kind == "SYS_STATUS":
                if msg.voltage_battery != SYS_STATUS_VOLTAGE_UNKNOWN:
                    d["voltage"] = msg.voltage_battery / 1000  # Volt
                if msg.current_battery != SYS_STATUS_CURRENT_UNKNOWN:
                    amps = msg.current_battery / 100  # Ampere
                    d["current"] = amps

                remaining = getattr(msg, "battery_remaining", 255)
                if remaining not in (None, 255):
                    d["power"]["remaining_percent"] = float(remaining)
                load = getattr(msg, "load", None)
                if load is not None:
                    d["power"]["load_percent"] = round(float(load) / 10, 1)
                d["power"]["source"] = "SYS_STATUS"
                d["health"].update(
                    {
                        "sensor_present": getattr(msg, "onboard_control_sensors_present", None),
                        "sensor_enabled": getattr(msg, "onboard_control_sensors_enabled", None),
                        "sensor_health": getattr(msg, "onboard_control_sensors_health", None),
                        "comm_drop_rate": getattr(msg, "drop_rate_comm", None),
                        "comm_errors": getattr(msg, "errors_comm", None),
                    }
                )

            elif kind == "BATTERY_STATUS":
                remaining = getattr(msg, "battery_remaining", 255)
                power = d["power"]
                power["source"] = "BATTERY_STATUS"
                power["battery_id"] = getattr(msg, "id", 0)
                if remaining not in (None, 255):
                    power["remaining_percent"] = float(remaining)
                energy = getattr(msg, "energy_consumed", -1)
                if energy not in (None, -1):
                    power["energy_consumed_wh"] = round(float(energy) / 1000, 3)
                temperature = getattr(msg, "temperature", 0)
                if temperature:
                    power["temperature_c"] = round(float(temperature) / 100, 1)
                voltages = [
                    round(value / 1000, 3)
                    for value in (getattr(msg, "voltages", None) or [])
                    if value and value < 32767
                ]
                if voltages:
                    power["cell_voltages_v"] = voltages

            elif kind == "POWER_STATUS":
                flags = int(getattr(msg, "flags", 0) or 0)
                d["power"]["source"] = "mixed"
                d["power"]["usb_connected"] = bool(flags & MAV_POWER_STATUS_USB_CONNECTED)
                d["power"]["power_brick_out"] = not bool(flags & MAV_POWER_STATUS_BRICK_VALID)

            elif kind == "RADIO_STATUS":
                d["link"].update(
                    {
                        "rssi": getattr(msg, "rssi", None),
                        "remrssi": getattr(msg, "remrssi", None),
                        "noise": getattr(msg, "noise", None),
                        "remnoise": getattr(msg, "remnoise", None),
                        "rx_errors": getattr(msg, "rxerrors", None),
                        "fixed": getattr(msg, "fixed", None),
                        "txbuf_percent": getattr(msg, "txbuf", None),
                    }
                )

            elif kind == "WIND_COV":
                wind_x = float(getattr(msg, "wind_x", 0) or 0) / 100
                wind_y = float(getattr(msg, "wind_y", 0) or 0) / 100
                d["nav"].update(
                    {
                        "wind_speed_mps": round(math.hypot(wind_x, wind_y), 2),
                        "wind_direction_deg": round(
                            (math.degrees(math.atan2(-wind_y, -wind_x)) + 360) % 360, 1
                        ),
                        "wind_source": "WIND_COV",
                    }
                )

            elif kind == "MISSION_CURRENT":
                d["mission"]["current_wp"] = getattr(msg, "seq", None)

            elif kind == "MISSION_COUNT":
                d["mission"]["total_wp"] = getattr(msg, "count", None)

            elif kind == "MISSION_ITEM_INT":
                x = getattr(msg, "x", None)
                y = getattr(msg, "y", None)
                if x is not None:
                    d["mission"]["next_wp_lat"] = x / 1e7
                if y is not None:
                    d["mission"]["next_wp_lon"] = y / 1e7

            elif kind == "NAV_CONTROLLER_OUTPUT":
                d["mission"].update(
                    {
                        "wp_distance_m": getattr(msg, "wp_dist", None),
                        "target_bearing_deg": getattr(msg, "target_bearing", None),
                        "nav_bearing_deg": getattr(msg, "nav_bearing", None),
                        "nav_roll_deg": getattr(msg, "nav_roll", None),
                        "nav_pitch_deg": getattr(msg, "nav_pitch", None),
                        "xtrack_error_m": getattr(msg, "xtrack_error", None),
                    }
                )

            elif kind == "EKF_STATUS_REPORT":
                flags = int(getattr(msg, "flags", 0) or 0)
                d["health"]["ekf_flags"] = flags
                d["health"]["ekf_ok"] = (flags & 0x1F) == 0x1F

            elif kind == "VIBRATION":
                clipping = sum(
                    int(getattr(msg, f"clipping_{index}", 0) or 0) for index in range(3)
                )
                d["health"].update(
                    {
                        "vibration_x": getattr(msg, "vibration_x", None),
                        "vibration_y": getattr(msg, "vibration_y", None),
                        "vibration_z": getattr(msg, "vibration_z", None),
                        "clipping_events": clipping,
                    }
                )

            elif kind == "STATUSTEXT":
                text = str(getattr(msg, "text", "") or "").strip()
                if text:
                    self._messages.append(
                        {
                            "time": datetime.now(timezone.utc),
                            "severity": int(getattr(msg, "severity", 0) or 0),
                            "text": text,
                            "component": getattr(msg, "component", None),
                        }
                    )

        if amps is not None:
            self._battery.update_current(amps)

    @staticmethod
    def _read_motors(msg: Any) -> list[dict]:
        """PWM output 1-4 Pixhawk (SERVO_OUTPUT_RAW) menjadi daftar motor dengan persen putaran."""
        span = MOTOR_PWM_MAX - MOTOR_PWM_MIN
        motors = []
        for i in range(1, MOTOR_COUNT + 1):
            pwm = int(getattr(msg, f"servo{i}_raw", 0))
            percent = min(100.0, max(0.0, (pwm - MOTOR_PWM_MIN) / span * 100))
            motors.append({"id": i, "pwm": pwm, "percent": round(percent, 1)})
        return motors

    @staticmethod
    def _read_servo_channels(msg: Any) -> list[dict]:
        """Semua output PWM SERVO_OUTPUT_RAW yang aktif (termasuk servo penebar benih)."""
        span = MOTOR_PWM_MAX - MOTOR_PWM_MIN
        channels = []
        for channel in range(1, 17):
            pwm = int(getattr(msg, f"servo{channel}_raw", 0) or 0)
            if pwm <= 0:
                continue
            percent = min(100.0, max(0.0, (pwm - MOTOR_PWM_MIN) / span * 100))
            channels.append(
                {"channel": channel, "pwm": pwm, "percent": round(percent, 1)}
            )
        return channels

    @staticmethod
    def _is_vehicle_heartbeat(msg: Any) -> bool:
        """Abaikan heartbeat dari Mission Planner/GCS yang ikut lewat MAVProxy."""
        if getattr(msg, "type", None) == MAV_TYPE_GCS:
            return False
        if getattr(msg, "autopilot", None) == MAV_AUTOPILOT_INVALID:
            return False
        return True

    def message_stats(self) -> list[dict]:
        """Pesan MAVLink yang sudah diterima: jumlah, umur pesan terakhir, dan laju rata-rata."""
        now = time.monotonic()
        with self._lock:
            items = [(k, v[0], v[1]) for k, v in self._msg_stats.items()]
            uptime = max(now - self._started_at, 1e-6)
        return sorted(
            (
                {
                    "type": kind,
                    "count": count,
                    "age_s": round(now - last, 2),
                    "avg_hz": round(count / uptime, 2),
                }
                for kind, count, last in items
            ),
            key=lambda x: x["type"],
        )

    # ---------- Data lengkap untuk dashboard ----------
    def get_status(self) -> DroneStatus:
        with self._lock:
            data = copy.deepcopy(self._data)
            messages = list(self._messages)
            last_update = self._last_update
            avg_speed = sum(self._speeds) / len(self._speeds) if self._speeds else None

        time_info = data.pop("time", {})
        power = data.pop("power", {})
        gps = data.pop("gps", {})
        nav = data.pop("nav", {})
        mission = data.pop("mission", {})
        health = data.pop("health", {})
        link = data.pop("link", {})
        servo = data.pop("servo", {})
        mission.setdefault("state", data.get("mode") or "IDLE")
        keywords = ("failsafe", "prearm", "pre-arm")
        health["failsafe"] = list(
            dict.fromkeys(
                item["text"]
                for item in messages
                if any(keyword in item["text"].lower() for keyword in keywords)
            )
        )

        return DroneStatus(
            **data,
            battery=self._battery.status(),
            seed=self._seeds.status(),
            gps=gps,
            nav=nav,
            mission=mission,
            servo=servo,
            avg_speed=avg_speed,
            time={"utc": last_update, "boot_ms": time_info.get("boot_ms")},
            power=power,
            health=health,
            link=link,
            messages=messages,
        )

    # ---------- Perintah ke Pixhawk ----------
    def set_servo(self, channel: int, pwm: int) -> None:
        link = self._link
        if link is None:
            raise DroneNotConnectedError()
        try:
            link.set_servo(channel, pwm)
            with self._lock:
                self._last_servo_command = {
                    "time": datetime.now(timezone.utc),
                    "channel": int(channel),
                    "pwm": int(pwm),
                }
        except Exception as exc:
            log.exception("Gagal mengirim DO_SET_SERVO channel=%s pwm=%s", channel, pwm)
            raise MavlinkCommandError() from exc

    def motor_test(
        self, instance: int, throttle_percent: float, timeout_s: float, count: int = 1
    ) -> None:
        link = self._link
        if link is None:
            raise DroneNotConnectedError()
        try:
            link.motor_test(instance, throttle_percent, timeout_s, count)
        except Exception as exc:
            log.exception("Gagal mengirim DO_MOTOR_TEST motor=%s", instance)
            raise MavlinkCommandError() from exc
