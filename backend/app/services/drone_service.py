"""Baca data dari Pixhawk (MAVLink) di background dan rangkum jadi status drone."""
import math
import threading
import time
from collections import deque
from typing import Any

from app.core.constants import (
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
    MAV_MODE_FLAG_SAFETY_ARMED,
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
            d = self._data
            stat = self._msg_stats.setdefault(kind, [0, 0.0])
            stat[0] += 1
            stat[1] = time.monotonic()

            if kind == "HEARTBEAT":
                if self._is_vehicle_heartbeat(msg):
                    d["mode"] = getattr(self._link, "flightmode", None)
                    d["armed"] = bool(msg.base_mode & MAV_MODE_FLAG_SAFETY_ARMED)

            elif kind == "GLOBAL_POSITION_INT":
                if msg.lat == 0 and msg.lon == 0:
                    # Pixhawk mengirim 0,0 selama belum ada GPS fix: itu bukan posisi sungguhan
                    d["lat"] = None
                    d["lon"] = None
                else:
                    d["lat"] = msg.lat / 1e7
                    d["lon"] = msg.lon / 1e7
                d["alt"] = msg.relative_alt / 1000  # meter

            elif kind == "ATTITUDE":
                d["pitch"] = math.degrees(msg.pitch)
                d["roll"] = math.degrees(msg.roll)
                d["yaw"] = math.degrees(msg.yaw) % 360

            elif kind == "VFR_HUD":
                d["speed"] = msg.groundspeed
                self._speeds.append(msg.groundspeed)

            elif kind == "GPS_RAW_INT":
                d["gps_fix"] = msg.fix_type
                d["satellites"] = msg.satellites_visible

            elif kind == "SERVO_OUTPUT_RAW":
                d["motors"] = self._read_motors(msg)

            elif kind == "COMMAND_ACK":
                if msg.command == MAV_CMD_DO_MOTOR_TEST and msg.result != 0:
                    log.warning("Pixhawk MENOLAK tes motor (kode hasil %s)", msg.result)

            elif kind == "SYS_STATUS":
                if msg.voltage_battery != SYS_STATUS_VOLTAGE_UNKNOWN:
                    d["voltage"] = msg.voltage_battery / 1000  # Volt
                if msg.current_battery != SYS_STATUS_CURRENT_UNKNOWN:
                    amps = msg.current_battery / 100  # Ampere
                    d["current"] = amps

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
            data = dict(self._data)
            avg_speed = sum(self._speeds) / len(self._speeds) if self._speeds else None
        return DroneStatus(
            **data,
            battery=self._battery.status(),
            seed=self._seeds.status(),
            avg_speed=avg_speed,
        )

    # ---------- Perintah ke Pixhawk ----------
    def set_servo(self, channel: int, pwm: int) -> None:
        link = self._link
        if link is None:
            raise DroneNotConnectedError()
        try:
            link.set_servo(channel, pwm)
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
