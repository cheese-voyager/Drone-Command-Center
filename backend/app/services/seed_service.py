"""Hitungan benih: dimuat, sudah di-drop, sisa."""
from app.schemas.seed import SeedConfig, SeedStatus
from app.services.config_store import ConfigStore


class SeedService:
    def __init__(self, config: ConfigStore):
        self._config = config

    def status(self) -> SeedStatus:
        seed = self._config.section("seed")
        return SeedStatus(
            loaded=seed["loaded"],
            dropped=seed["dropped"],
            remaining=seed["loaded"] - seed["dropped"],
        )

    @property
    def remaining(self) -> int:
        return self.status().remaining

    def load(self, loaded: int) -> SeedConfig:
        """Isi jumlah benih yang dimuat. Hitungan benih terdrop di-reset ke 0."""
        seed = self._config.update_section("seed", {"loaded": loaded, "dropped": 0})
        return SeedConfig(**seed)

    def consume(self, amount: int) -> None:
        self._config.increment("seed", "dropped", amount)
