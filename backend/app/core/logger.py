"""Logging ke konsol dan ke file `logs/backend.log` (berputar otomatis)."""
import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

ROOT_LOGGER_NAME = "seeder"
_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"


def setup_logging(level: str = "INFO", log_dir: Path | None = None) -> None:
    """Aman dipanggil berulang kali: handler lama dibuang dulu."""
    logger = logging.getLogger(ROOT_LOGGER_NAME)
    logger.setLevel(level.upper())

    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()

    formatter = logging.Formatter(_FORMAT)

    console = logging.StreamHandler(sys.stderr)
    console.setFormatter(formatter)
    logger.addHandler(console)

    if log_dir is not None:
        try:
            Path(log_dir).mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                Path(log_dir) / "backend.log",
                maxBytes=1_000_000,
                backupCount=3,
                encoding="utf-8",
            )
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        except OSError as exc:  # folder log tidak bisa ditulis: cukup log ke konsol
            logger.warning("Log file dinonaktifkan: %s", exc)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"{ROOT_LOGGER_NAME}.{name}")
