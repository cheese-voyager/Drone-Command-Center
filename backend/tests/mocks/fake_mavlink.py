"""Pixhawk tiruan untuk tes: menampung pesan masuk dan merekam perintah servo keluar."""
import queue
from collections.abc import Callable
from types import SimpleNamespace
from typing import Any

ARMED_FLAG = 128  # MAV_MODE_FLAG_SAFETY_ARMED
VEHICLE_TYPE_QUADROTOR = 2
AUTOPILOT_ARDUPILOT = 3


class FakeMavlinkLink:
    def __init__(self):
        self._queue: queue.Queue = queue.Queue()
        self.flightmode: str | None = "GUIDED"
        self.servo_commands: list[tuple[int, int]] = []
        self.stream_requests: list[int] = []
        self.motor_commands: list[tuple[int, float, float, int]] = []
        self.connect_calls = 0
        self.closed = False
        self.fail_servo = False
        self.connect_error: Exception | None = None  # dilempar sekali pada connect()

    # ---- antarmuka MavlinkLink ----
    def connect(self, should_stop: Callable[[], bool]) -> bool:
        self.connect_calls += 1
        self.closed = False
        if self.connect_error is not None:
            error, self.connect_error = self.connect_error, None
            raise error
        return not should_stop()

    def request_streams(self, rate_hz: int) -> None:
        self.stream_requests.append(rate_hz)

    def recv(self, timeout: float) -> Any | None:
        try:
            return self._queue.get(timeout=min(timeout, 0.02))
        except queue.Empty:
            return None

    def set_servo(self, channel: int, pwm: int) -> None:
        if self.fail_servo:
            raise OSError("koneksi putus")
        self.servo_commands.append((channel, pwm))

    def motor_test(self, instance: int, throttle_percent: float, timeout_s: float, count: int):
        if self.fail_servo:
            raise OSError("koneksi putus")
        self.motor_commands.append((instance, throttle_percent, timeout_s, count))

    def close(self) -> None:
        self.closed = True

    # ---- bantuan untuk tes ----
    def push(self, *messages: Any) -> None:
        for message in messages:
            self._queue.put(message)


def _msg(kind: str, **fields) -> SimpleNamespace:
    return SimpleNamespace(get_type=lambda: kind, **fields)


def heartbeat(
    armed: bool = False,
    type_: int = VEHICLE_TYPE_QUADROTOR,
    autopilot: int = AUTOPILOT_ARDUPILOT,
):
    return _msg(
        "HEARTBEAT",
        type=type_,
        autopilot=autopilot,
        base_mode=ARMED_FLAG if armed else 0,
    )


def gcs_heartbeat():
    """Heartbeat dari Mission Planner (bukan dari drone)."""
    return heartbeat(armed=False, type_=6, autopilot=8)


def global_position(
    lat: float,
    lon: float,
    relative_alt_m: float,
    *,
    alt_m: float | None = None,
    hdg: int = 8300,
):
    return _msg(
        "GLOBAL_POSITION_INT",
        time_boot_ms=0,
        lat=int(lat * 1e7),
        lon=int(lon * 1e7),
        alt=0 if alt_m is None else int(alt_m * 1000),
        relative_alt=int(relative_alt_m * 1000),
        vx=320,
        vy=150,
        vz=-20,
        hdg=hdg,
    )


def attitude(pitch_rad: float, roll_rad: float, yaw_rad: float):
    return _msg("ATTITUDE", pitch=pitch_rad, roll=roll_rad, yaw=yaw_rad)


def vfr_hud(
    groundspeed: float,
    *,
    airspeed: float = 4.0,
    climb: float = 0.6,
    throttle: int = 42,
    heading: int = 83,
):
    return _msg(
        "VFR_HUD",
        airspeed=airspeed,
        groundspeed=groundspeed,
        heading=heading,
        throttle=throttle,
        climb=climb,
    )


def gps_raw(
    fix_type: int,
    satellites: int,
    *,
    eph: int = 65,
    epv: int = 90,
    alt_m: float = 15.0,
    vel: int = 350,
    cog: int = 8300,
):
    return _msg(
        "GPS_RAW_INT",
        fix_type=fix_type,
        satellites_visible=satellites,
        eph=eph,
        epv=epv,
        alt=int(alt_m * 1000),
        vel=vel,
        cog=cog,
    )


def sys_status(
    voltage_v: float | None = None,
    current_a: float | None = None,
    *,
    battery_remaining: int = 255,
    load: int = 0,
    sensors_present: int = 0,
    sensors_enabled: int = 0,
    sensors_health: int = 0,
    drop_rate_comm: int = 0,
    errors_comm: int = 0,
):
    """None berarti 'tidak diketahui' (65535 mV / -1 cA), seperti Pixhawk tanpa power module."""
    return _msg(
        "SYS_STATUS",
        onboard_control_sensors_present=sensors_present,
        onboard_control_sensors_enabled=sensors_enabled,
        onboard_control_sensors_health=sensors_health,
        load=load,
        voltage_battery=65535 if voltage_v is None else int(voltage_v * 1000),
        current_battery=-1 if current_a is None else int(current_a * 100),
        battery_remaining=battery_remaining,
        drop_rate_comm=drop_rate_comm,
        errors_comm=errors_comm,
    )


def servo_output(
    m1: int,
    m2: int,
    m3: int,
    m4: int,
    *,
    seed_channel: int = 9,
    seed_pwm: int = 1800,
):
    """PWM output motor 1-4 (1000 = diam, 2000 = penuh) + servo penebar benih."""
    fields = {f"servo{i}_raw": pwm for i, pwm in enumerate((m1, m2, m3, m4), start=1)}
    fields.update({f"servo{i}_raw": 1000 for i in range(5, 17)})
    fields[f"servo{seed_channel}_raw"] = seed_pwm
    return _msg("SERVO_OUTPUT_RAW", **fields)


def battery_status(remaining: int = 82, energy_mwh: int = 3500, cells: tuple[int, ...] = ()):
    return _msg(
        "BATTERY_STATUS",
        id=0,
        temperature=2450,
        voltages=list(cells),
        current_battery=1800,
        current_consumed=1200,
        energy_consumed=energy_mwh,
        battery_remaining=remaining,
    )


def power_status(usb: bool = False, brick_valid: bool = True):
    flags = (4 if usb else 0) | (1 if brick_valid else 0)
    return _msg("POWER_STATUS", Vcc=5000, Vservo=5000, flags=flags)


def radio_status(rssi: int = 60, rxerrors: int = 3, fixed: int = 120):
    return _msg(
        "RADIO_STATUS",
        rssi=rssi,
        remrssi=58,
        txbuf=20,
        noise=95,
        remnoise=97,
        rxerrors=rxerrors,
        fixed=fixed,
    )


def ekf_status(flags: int = 0x1F):
    return _msg("EKF_STATUS_REPORT", flags=flags)


def vibration(x: float = 0.2, y: float = 0.3, z: float = 0.5, clipping: int = 2):
    return _msg(
        "VIBRATION",
        vibration_x=x,
        vibration_y=y,
        vibration_z=z,
        clipping_0=clipping,
        clipping_1=0,
        clipping_2=1,
    )


def status_text(text: str, severity: int = 2, component: int = 3):
    return _msg("STATUSTEXT", severity=severity, text=text, component=component)


def wind_cov(wind_x: float = 2.0, wind_y: float = -1.5):
    return _msg("WIND_COV", wind_x=int(wind_x * 100), wind_y=int(wind_y * 100))


def mission_current(seq: int = 2):
    return _msg("MISSION_CURRENT", seq=seq)


def mission_count(count: int = 6):
    return _msg("MISSION_COUNT", count=count)


def mission_item_int(seq: int = 3, lat: float = -6.918, lon: float = 107.620):
    return _msg("MISSION_ITEM_INT", seq=seq, x=int(lat * 1e7), y=int(lon * 1e7))


def nav_controller_output(
    wp_dist: int = 45,
    target_bearing: int = 83,
    nav_bearing: int = 80,
    nav_roll: float = 2.5,
    nav_pitch: float = -1.2,
    xtrack_error: float = 0.4,
):
    return _msg(
        "NAV_CONTROLLER_OUTPUT",
        wp_dist=wp_dist,
        target_bearing=target_bearing,
        nav_bearing=nav_bearing,
        nav_roll=nav_roll,
        nav_pitch=nav_pitch,
        xtrack_error=xtrack_error,
    )


def command_ack(command: int, result: int = 0):
    return _msg("COMMAND_ACK", command=command, result=result)
