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


def global_position(lat: float, lon: float, relative_alt_m: float):
    return _msg(
        "GLOBAL_POSITION_INT",
        lat=int(lat * 1e7),
        lon=int(lon * 1e7),
        relative_alt=int(relative_alt_m * 1000),
    )


def attitude(pitch_rad: float, roll_rad: float, yaw_rad: float):
    return _msg("ATTITUDE", pitch=pitch_rad, roll=roll_rad, yaw=yaw_rad)


def vfr_hud(groundspeed: float):
    return _msg("VFR_HUD", groundspeed=groundspeed)


def gps_raw(fix_type: int, satellites: int):
    return _msg("GPS_RAW_INT", fix_type=fix_type, satellites_visible=satellites)


def sys_status(voltage_v: float | None = None, current_a: float | None = None):
    """None berarti 'tidak diketahui' (65535 mV / -1 cA), seperti Pixhawk tanpa power module."""
    return _msg(
        "SYS_STATUS",
        voltage_battery=65535 if voltage_v is None else int(voltage_v * 1000),
        current_battery=-1 if current_a is None else int(current_a * 100),
    )


def servo_output(m1: int, m2: int, m3: int, m4: int):
    """PWM output motor 1-4 (1000 = diam, 2000 = penuh)."""
    return _msg("SERVO_OUTPUT_RAW", servo1_raw=m1, servo2_raw=m2, servo3_raw=m3, servo4_raw=m4)
