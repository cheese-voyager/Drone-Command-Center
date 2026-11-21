"""Pembungkus pymavlink. Service lain hanya bicara lewat `MavlinkLink`, jadi mudah ditukar
dengan tiruan (lihat tests/mocks/fake_mavlink.py) saat tes tanpa Pixhawk."""
import threading
from collections.abc import Callable
from typing import Any, Protocol

from pymavlink import mavutil

from app.core.logger import get_logger

log = get_logger("mavlink")

HEARTBEAT_WARN_EVERY_S = 10

MAV_MODE_FLAG_SAFETY_ARMED = mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED
MAV_TYPE_GCS = mavutil.mavlink.MAV_TYPE_GCS
MAV_AUTOPILOT_INVALID = mavutil.mavlink.MAV_AUTOPILOT_INVALID
MAV_DATA_STREAM_ALL = mavutil.mavlink.MAV_DATA_STREAM_ALL
MAV_CMD_DO_SET_SERVO = mavutil.mavlink.MAV_CMD_DO_SET_SERVO
MAV_CMD_SET_MESSAGE_INTERVAL = mavutil.mavlink.MAV_CMD_SET_MESSAGE_INTERVAL
MAV_POWER_STATUS_BRICK_VALID = mavutil.mavlink.MAV_POWER_STATUS_BRICK_VALID
MAV_POWER_STATUS_USB_CONNECTED = mavutil.mavlink.MAV_POWER_STATUS_USB_CONNECTED
REQUIRED_MESSAGE_IDS = (1, 24, 30, 33, 36, 42, 44, 62, 73, 74, 109, 113, 125, 147, 193, 231, 253)
MAV_RESULT_LABELS = {
    0: "ACCEPTED",
    1: "REJECTED",
    2: "REJECTED",
    3: "REJECTED",
    4: "FAILED",
    5: "IN_PROGRESS",
    6: "CANCELLED",
}
MAV_CMD_DO_MOTOR_TEST = mavutil.mavlink.MAV_CMD_DO_MOTOR_TEST
MOTOR_TEST_THROTTLE_PERCENT = mavutil.mavlink.MOTOR_TEST_THROTTLE_PERCENT
MOTOR_TEST_ORDER_BOARD = mavutil.mavlink.MOTOR_TEST_ORDER_BOARD  # nomor = output Pixhawk


class MavlinkLink(Protocol):
    @property
    def flightmode(self) -> str | None: ...

    def connect(self, should_stop: Callable[[], bool]) -> bool:
        """Tunggu heartbeat pertama. Return False kalau dihentikan sebelum terhubung."""

    def request_streams(self, rate_hz: int) -> None: ...

    def recv(self, timeout: float) -> Any | None:
        """Ambil satu pesan MAVLink, atau None kalau tidak ada dalam `timeout` detik."""

    def set_servo(self, channel: int, pwm: int) -> None: ...

    def motor_test(
        self, instance: int, throttle_percent: float, timeout_s: float, count: int
    ) -> None:
        """Putar motor `instance` (1-4, urutan output Pixhawk) selama `timeout_s` detik.
        `count` > 1 = tes berurutan mulai dari `instance`. Pixhawk yang menghentikannya sendiri."""

    def close(self) -> None: ...


MavlinkFactory = Callable[[str], MavlinkLink]


def _no_heartbeat_hint(connection: str) -> str:
    if connection.lower().startswith("udpin"):
        return (
            "Mode udpin hanya MENDENGARKAN: harus ada program lain (MAVProxy/Mission Planner) "
            "yang mengirim ke alamat ini, mis. mavproxy.py --out=udp:127.0.0.1:14551. "
            "Kalau Pixhawk dicolok langsung ke komputer ini, pakai MAVLINK_CONN=COM3,57600 "
            "(atau /dev/ttyACM0,115200). Kalau pengirimnya di komputer lain, dengarkan di "
            "udpin:0.0.0.0:<port>, bukan 127.0.0.1."
        )
    if _is_network(connection):
        return "Cek alamat/port dan firewall, dan pastikan sumber MAVLink-nya jalan."
    return (
        "Cek nama port dan baud rate (USB biasanya 115200, telemetry radio 57600), dan pastikan "
        "tidak ada program lain (Mission Planner, MAVProxy, skrip tes) yang memegang port ini."
    )


def split_connection(connection: str) -> tuple[str, int | None]:
    """Pisahkan "COM3,57600" menjadi ("COM3", 57600). pymavlink sendiri tidak membaca baud dari
    string; harus lewat argumen `baud`. String UDP/TCP (ada ':' sebelum koma) dibiarkan utuh."""
    device, sep, baud = connection.rpartition(",")
    if sep and baud.strip().isdigit() and not device.lower().startswith(("udp", "tcp")):
        return device.strip(), int(baud)
    return connection, None


def _is_network(connection: str) -> bool:
    return connection.lower().startswith(("udp", "tcp"))


class PymavlinkLink:
    def __init__(self, connection: str):
        # contoh: "udpin:127.0.0.1:14551", "COM3,57600", "/dev/ttyACM0,115200"
        self.connection = connection
        self._master = None
        self._send_lock = threading.Lock()

    @property
    def flightmode(self) -> str | None:
        return getattr(self._master, "flightmode", None)

    def connect(self, should_stop: Callable[[], bool]) -> bool:
        device, baud = split_connection(self.connection)
        kwargs = {"baud": baud} if baud else {}
        self._master = mavutil.mavlink_connection(device, **kwargs)
        # Tunggu per 1 detik supaya bisa berhenti kalau aplikasi dimatikan
        waited = 0
        while not should_stop():
            if self._master.wait_heartbeat(timeout=1) is not None:
                return True
            waited += 1
            if waited % HEARTBEAT_WARN_EVERY_S == 0:
                log.warning(
                    "Belum ada HEARTBEAT di %s setelah %d detik. %s",
                    self.connection,
                    waited,
                    _no_heartbeat_hint(self.connection),
                )
        return False

    def request_streams(self, rate_hz: int) -> None:
        m = self._master
        # Cara lama (semua firmware)...
        m.mav.request_data_stream_send(
            m.target_system, m.target_component, MAV_DATA_STREAM_ALL, rate_hz, 1
        )
        # ...ditambah cara baru per pesan: lebih pasti sampai dan hemat bandwidth, penting di
        # telemetry 57600. Firmware yang tidak mendukung cukup membalas "unsupported".
        interval_us = int(1_000_000 / rate_hz)
        for msg_id in REQUIRED_MESSAGE_IDS:
            with self._send_lock:
                m.mav.command_long_send(
                    m.target_system,
                    m.target_component,
                    MAV_CMD_SET_MESSAGE_INTERVAL,
                    0,
                    msg_id,
                    interval_us,
                    0,
                    0,
                    0,
                    0,
                    0,
                )

    def recv(self, timeout: float) -> Any | None:
        return self._master.recv_match(blocking=True, timeout=timeout)

    def set_servo(self, channel: int, pwm: int) -> None:
        m = self._master
        with self._send_lock:
            m.mav.command_long_send(
                m.target_system,
                m.target_component,
                MAV_CMD_DO_SET_SERVO,
                0,
                channel,
                pwm,
                0,
                0,
                0,
                0,
                0,
            )

    def motor_test(
        self, instance: int, throttle_percent: float, timeout_s: float, count: int
    ) -> None:
        m = self._master
        with self._send_lock:
            m.mav.command_long_send(
                m.target_system,
                m.target_component,
                MAV_CMD_DO_MOTOR_TEST,
                0,
                instance,
                MOTOR_TEST_THROTTLE_PERCENT,
                throttle_percent,
                timeout_s,
                count,
                MOTOR_TEST_ORDER_BOARD,
                0,
            )

    def close(self) -> None:
        if self._master is not None:
            try:
                self._master.close()
            except Exception:
                pass


def create_link(connection: str) -> MavlinkLink:
    return PymavlinkLink(connection)
