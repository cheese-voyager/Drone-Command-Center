"""Mengendalikan thruster/servo drop lewat PWM. Dipakai bersama oleh drop dan tes thruster."""
import threading
import time

from app.core.constants import (
    MAX_DURATION_S,
    MOTOR_TEST_MAX_PERCENT,
    SERVO_OFF_RETRIES,
    SERVO_OFF_RETRY_DELAY_S,
    THRUST_MAX_PERCENT,
    THRUST_MIN_PERCENT,
)
from app.core.exceptions import (
    BusyError,
    DroneArmedError,
    DroneNotConnectedError,
    InvalidParameterError,
)
from app.core.logger import get_logger
from app.schemas.thruster import ThrusterTestResponse
from app.services.config_store import ConfigStore
from app.services.drone_service import DroneService

log = get_logger("thruster")


def validate_thrust(thrust: float) -> None:
    if not THRUST_MIN_PERCENT <= thrust <= THRUST_MAX_PERCENT:
        raise InvalidParameterError("thrust harus 0-100")


def validate_duration(duration: float) -> None:
    if not 0 < duration <= MAX_DURATION_S:
        raise InvalidParameterError("duration harus 0-10 detik (batas aman tes)")


def thrust_to_pwm(thrust: float, pwm_min: int, pwm_max: int) -> int:
    """Thrust 0-100% menjadi PWM pwm_min-pwm_max (default 1000-2000)."""
    return int(pwm_min + (pwm_max - pwm_min) * thrust / 100)


class ThrusterService:
    def __init__(self, config: ConfigStore, drone: DroneService):
        self._config = config
        self._drone = drone
        self._lock = threading.Lock()
        self._busy = False
        self._stop_event = threading.Event()  # untuk stop darurat
        self._motor_test_active = False

    @property
    def busy(self) -> bool:
        with self._lock:
            return self._busy

    # ---------- Satu putaran: reserve -> start_pulse (-> selesai otomatis) ----------
    def reserve(self, busy_message: str = "Thruster sedang berjalan") -> None:
        """Ambil hak pakai thruster. Dicek atomik supaya dua perintah tidak jalan bersamaan."""
        with self._lock:
            if self._busy:
                raise BusyError(busy_message)
            if not self._drone.is_connected:
                raise DroneNotConnectedError()
            self._busy = True

    def release(self) -> None:
        with self._lock:
            self._busy = False

    def start_pulse(self, thrust: float, duration: float) -> int:
        """Nyalakan thruster sekarang, lalu matikan sendiri setelah `duration` detik.

        Harus dipanggil setelah `reserve()`. Kalau perintah nyala gagal, hak pakai
        dilepas otomatis dan error diteruskan. Return nilai PWM yang dikirim."""
        d = self._config.section("drop")
        channel, pwm_min = d["servo_channel"], d["pwm_min"]
        pwm = thrust_to_pwm(thrust, pwm_min, d["pwm_max"])

        self._stop_event.clear()
        try:
            self._drone.set_servo(channel, pwm)  # nyalakan
        except Exception:
            self.release()
            raise

        threading.Thread(
            target=self._finish_pulse,
            args=(channel, pwm_min, duration),
            name="thruster-timer",
            daemon=True,
        ).start()
        return pwm

    def _finish_pulse(self, channel: int, pwm_min: int, duration: float) -> None:
        try:
            self._stop_event.wait(duration)  # tunggu (bisa dibatalkan stop darurat)
        finally:
            self._servo_off(channel, pwm_min)
            self.release()

    def _servo_off(self, channel: int, pwm_min: int) -> bool:
        for attempt in range(1, SERVO_OFF_RETRIES + 1):
            try:
                self._drone.set_servo(channel, pwm_min)
                return True
            except Exception:
                log.error("Gagal mematikan servo (percobaan %d/%d)", attempt, SERVO_OFF_RETRIES)
                time.sleep(SERVO_OFF_RETRY_DELAY_S)
        log.critical(
            "SERVO MUNGKIN MASIH MENYALA: channel %s tidak bisa dikembalikan ke PWM min", channel
        )
        return False

    # ---------- Tes thruster (tanpa mengurangi benih, tanpa catat drop) ----------
    def test(
        self, thrust: float, duration: float, target: str = "seeder"
    ) -> ThrusterTestResponse:
        validate_thrust(thrust)
        validate_duration(duration)
        if target != "seeder":
            return self._test_motors(target, thrust, duration)
        self.reserve("Thruster sedang berjalan")
        pwm = self.start_pulse(thrust, duration)
        return ThrusterTestResponse(target=target, thrust=thrust, duration=duration, pwm=pwm)

    # ---------- Tes 4 motor penggerak (DO_MOTOR_TEST) ----------
    def _test_motors(self, target: str, thrust: float, duration: float) -> ThrusterTestResponse:
        """`motor_1`..`motor_4` = satu motor. `all_motors` = motor 1-4 berurutan.

        Pixhawk sendiri yang menghentikan motor setelah `duration`, jadi motor tetap berhenti
        walau koneksi putus di tengah tes."""
        if thrust > MOTOR_TEST_MAX_PERCENT:
            raise InvalidParameterError(f"thrust tes motor maksimal {MOTOR_TEST_MAX_PERCENT:g}%")
        if target == "all_motors":
            first, count = 1, 4
        else:
            first, count = int(target.removeprefix("motor_")), 1

        self.reserve("Thruster sedang berjalan")
        try:
            if self._drone.is_armed:
                raise DroneArmedError()
            self._stop_event.clear()
            self._drone.motor_test(first, thrust, duration, count)
        except BaseException:
            self.release()
            raise

        total = duration * count
        self._motor_test_active = True
        threading.Thread(
            target=self._finish_motor_test, args=(total,), name="motor-test-timer", daemon=True
        ).start()
        return ThrusterTestResponse(
            target=target, thrust=thrust, duration=duration, total_duration=total
        )

    def _finish_motor_test(self, total: float) -> None:
        try:
            self._stop_event.wait(total)
        finally:
            self._motor_test_active = False
            self.release()

    def stop(self) -> bool:
        """Stop darurat: batalkan timer dan langsung kembalikan ke PWM minimum.

        Return False kalau perintah stop tidak berhasil terkirim ke Pixhawk."""
        self._stop_event.set()
        if not self._drone.has_link:
            return True  # belum pernah terhubung, tidak ada yang bisa berjalan
        d = self._config.section("drop")
        try:
            if self._motor_test_active:
                self._drone.motor_test(1, 0.0, 0.0, 1)  # throttle 0, timeout 0 = berhenti
            self._drone.set_servo(d["servo_channel"], d["pwm_min"])
            return True
        except Exception:
            log.critical("STOP DARURAT GAGAL TERKIRIM ke Pixhawk")
            return False
