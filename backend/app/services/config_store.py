"""Penyimpanan pengaturan ke `config.json` (aman dipakai banyak thread)."""
import json
import os
import threading
from collections.abc import Mapping
from copy import deepcopy
from pathlib import Path
from typing import Any

from app.core.constants import DEFAULT_CONFIG
from app.core.logger import get_logger

log = get_logger("config_store")


def atomic_write_json(path: Path, data: Any) -> None:
    """Tulis ke file sementara lalu ganti file asli, supaya tidak rusak kalau listrik mati."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)


def backup_corrupt(path: Path) -> None:
    """Pindahkan file rusak ke `<nama>.corrupt` supaya bisa diperiksa nanti."""
    path = Path(path)
    try:
        os.replace(path, path.with_name(path.name + ".corrupt"))
    except OSError:
        pass


def _deep_merge(base: dict, override: Mapping) -> dict:
    """Nilai dari `override` menimpa `base`; key yang hilang di override diisi dari base."""
    merged = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, Mapping) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = deepcopy(value)
    return merged


class ConfigStore:
    def __init__(self, path: Path, defaults: dict | None = None):
        self.path = Path(path)
        self._defaults = deepcopy(DEFAULT_CONFIG if defaults is None else defaults)
        self._lock = threading.RLock()
        self._data = self._load()

    def _load(self) -> dict:
        if not self.path.exists():
            data = deepcopy(self._defaults)
            atomic_write_json(self.path, data)
            return data
        try:
            with open(self.path, encoding="utf-8") as f:
                raw = json.load(f)
            if not isinstance(raw, dict):
                raise ValueError("isi config bukan object JSON")
        except (OSError, ValueError) as exc:
            log.error("config.json rusak (%s). Dibackup, dipakai nilai default.", exc)
            backup_corrupt(self.path)
            data = deepcopy(self._defaults)
            atomic_write_json(self.path, data)
            return data
        return _deep_merge(self._defaults, raw)

    def snapshot(self) -> dict:
        with self._lock:
            return deepcopy(self._data)

    def section(self, name: str) -> dict:
        """Salinan satu bagian config (`battery`, `drop`, atau `seed`)."""
        with self._lock:
            return deepcopy(self._data[name])

    def update_section(self, name: str, values: Mapping) -> dict:
        """Gabungkan `values` ke bagian `name`, simpan ke file, kembalikan salinannya."""
        with self._lock:
            self._data[name] = {**self._data.get(name, {}), **deepcopy(dict(values))}
            atomic_write_json(self.path, self._data)
            return deepcopy(self._data[name])

    def increment(self, name: str, key: str, amount: int | float) -> int | float:
        with self._lock:
            self._data[name][key] += amount
            atomic_write_json(self.path, self._data)
            return self._data[name][key]
