"""Hitungan baterai: mAh terpakai, sisa %, dan estimasi waktu terbang.

Kapasitas baterai diisi manual lewat `POST /battery`, sisa dihitung dari arus Pixhawk."""
import threading
import time
from collections import deque
from collections.abc import Callable

from app.core.constants import AMP_SECONDS_PER_MAH, CURRENT_MIN_FOR_ESTIMATE_A, ROLLING_WINDOW
from app.schemas.battery import BatteryConfig, BatteryStatus
from app.services.config_store import ConfigStore


class BatteryService:
    def __init__(self, config: ConfigStore, clock: Callable[[], float] = time.time):
        self._config = config
        self._clock = clock
        self._lock = threading.Lock()
        self._used_mah = 0.0
        self._last_time: float | None = None
        self._currents: deque[float] = deque(maxlen=ROLLING_WINDOW)

    @property
    def used_mah(self) -> float:
        with self._lock:
            return self._used_mah

    def update_current(self, amps: float) -> None:
        """Catat satu sampel arus (Ampere) lalu jumlahkan arus x waktu menjadi mAh."""
        now = self._clock()
        with self._lock:
            self._currents.append(amps)
            if self._last_time is not None:
                seconds = now - self._last_time
                used = self._used_mah + amps * seconds / AMP_SECONDS_PER_MAH
                self._used_mah = max(used, 0.0)
            self._last_time = now

    def pause(self) -> None:
        """Panggil saat data terputus, supaya jeda tidak ikut dihitung sebagai pemakaian."""
        with self._lock:
            self._last_time = None

    def reset(self) -> None:
        """Panggil saat ganti baterai baru."""
        with self._lock:
            self._used_mah = 0.0
            self._last_time = None
            self._currents.clear()

    def configure(self, cfg: BatteryConfig) -> BatteryConfig:
        """Simpan data baterai baru dan reset hitungan mAh terpakai."""
        self._config.update_section("battery", cfg.model_dump())
        self.reset()
        return cfg

    def status(self) -> BatteryStatus:
        cfg = self._config.section("battery")
        capacity = cfg["capacity_mah"]
        with self._lock:
            used = self._used_mah
            avg_current = sum(self._currents) / len(self._currents) if self._currents else None

        remaining = max(capacity - used, 0.0)
        percent = remaining / capacity * 100 if capacity > 0 else 0.0

        # Estimasi sisa waktu terbang (menit) = sisa Ah / rata-rata arus
        minutes_left = None
        if avg_current and avg_current > CURRENT_MIN_FOR_ESTIMATE_A:
            minutes_left = remaining / 1000 / avg_current * 60

        return BatteryStatus(
            capacity_mah=capacity,
            used_mah=round(used, 1),
            remaining_mah=round(remaining, 1),
            remaining_percent=round(percent, 1),
            avg_current=avg_current,
            estimated_minutes_left=minutes_left,
            low=percent < cfg["min_safe_percent"],
        )
