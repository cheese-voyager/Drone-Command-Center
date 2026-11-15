"""Riwayat titik drop, disimpan ke `drops.json` supaya tidak hilang saat restart."""
import json
import threading
from pathlib import Path

from pydantic import ValidationError

from app.core.constants import MAX_DROP_HISTORY
from app.core.logger import get_logger
from app.schemas.drop import DropRecord
from app.services.config_store import atomic_write_json, backup_corrupt

log = get_logger("drop_history")


class DropHistory:
    def __init__(self, path: Path, max_records: int = MAX_DROP_HISTORY):
        self.path = Path(path)
        self._max = max_records
        self._lock = threading.Lock()
        self._records: list[DropRecord] = self._load()

    def _load(self) -> list[DropRecord]:
        if not self.path.exists():
            atomic_write_json(self.path, [])
            return []
        try:
            with open(self.path, encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, list):
                raise ValueError("isi drops.json bukan list")
        except (OSError, ValueError) as exc:
            log.error("drops.json rusak (%s). Dibackup, riwayat dikosongkan.", exc)
            backup_corrupt(self.path)
            atomic_write_json(self.path, [])
            return []

        records = []
        for item in raw:
            try:
                records.append(DropRecord(**item))
            except (ValidationError, TypeError):
                log.warning("Entri riwayat drop dilewati karena tidak valid: %r", item)
        return records[-self._max :]

    def add(self, record: DropRecord) -> DropRecord:
        with self._lock:
            self._records.append(record)
            self._records = self._records[-self._max :]
            atomic_write_json(self.path, [r.model_dump() for r in self._records])
        return record

    def list(self) -> list[DropRecord]:
        with self._lock:
            return list(self._records)

    def __len__(self) -> int:
        with self._lock:
            return len(self._records)
