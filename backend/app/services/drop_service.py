"""Drop benih: atur thrust/durasi, jalankan drop, catat titik drop."""
import time
from collections.abc import Callable

from app.core.exceptions import NotEnoughSeedsError
from app.core.logger import get_logger
from app.schemas.drop import DropConfig, DropConfigRequest, DropRecord
from app.services.config_store import ConfigStore
from app.services.drone_service import DroneService
from app.services.drop_history import DropHistory
from app.services.seed_service import SeedService
from app.services.thruster_service import ThrusterService, validate_duration, validate_thrust

log = get_logger("drop")


class DropService:
    def __init__(
        self,
        config: ConfigStore,
        seeds: SeedService,
        thruster: ThrusterService,
        drone: DroneService,
        history: DropHistory,
    ):
        self._config = config
        self._seeds = seeds
        self._thruster = thruster
        self._drone = drone
        self._history = history
        self._listeners: list[Callable[[DropRecord], None]] = []

    def add_listener(self, listener: Callable[[DropRecord], None]) -> None:
        """Daftarkan fungsi yang dipanggil setiap selesai drop (dipakai MQTT untuk event)."""
        self._listeners.append(listener)

    def get_config(self) -> DropConfig:
        return DropConfig(**self._config.section("drop"))

    def update_config(self, req: DropConfigRequest) -> DropConfig:
        """Atur thrust (0-100) dan durasi (detik) untuk drop berikutnya."""
        values = {}
        if req.thrust_percent is not None:
            validate_thrust(req.thrust_percent)
            values["thrust_percent"] = req.thrust_percent
        if req.duration_s is not None:
            validate_duration(req.duration_s)
            values["duration_s"] = req.duration_s
        return DropConfig(**self._config.update_section("drop", values))

    def drop(self, thrust: float | None = None, duration: float | None = None) -> DropRecord:
        """Jalankan drop dengan pengaturan tersimpan (atau nilai yang diberikan)."""
        d = self._config.section("drop")
        thrust = d["thrust_percent"] if thrust is None else thrust
        duration = d["duration_s"] if duration is None else duration
        validate_thrust(thrust)
        validate_duration(duration)

        self._thruster.reserve("Drop sedang berjalan")
        try:
            if self._seeds.remaining < d["seeds_per_drop"]:
                raise NotEnoughSeedsError()
        except BaseException:
            self._thruster.release()
            raise

        lat, lon = self._drone.position()
        taken_at = time.time()
        # Kalau perintah ke Pixhawk gagal, error naik ke sini dan benih tidak dikurangi
        self._thruster.start_pulse(thrust, duration)

        record = DropRecord(time=taken_at, lat=lat, lon=lon, thrust=thrust, duration=duration)
        self._history.add(record)
        self._seeds.consume(d["seeds_per_drop"])
        for listener in self._listeners:
            try:
                listener(record)
            except Exception:  # pendengar yang error tidak boleh menggagalkan drop
                log.exception("Pendengar drop gagal")
        return record

    def history(self) -> list[DropRecord]:
        return self._history.list()
