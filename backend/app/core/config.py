"""Pengaturan aplikasi. Dibaca dari environment variable atau file `.env`."""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core import constants

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Drone Penebar Benih"
    app_version: str = "1.0.0"

    # Server (dipakai kalau dijalankan lewat `python -m app.main`)
    host: str = "0.0.0.0"
    port: int = 8000

    # Alamat MAVLink dari MAVProxy
    mavlink_conn: str = "udpin:127.0.0.1:14551"
    # Isi false untuk menjalankan API tanpa Pixhawk (misalnya saat mengembangkan dashboard)
    mavlink_enabled: bool = True
    mavlink_stream_rate_hz: int = Field(constants.MAVLINK_STREAM_RATE_HZ, ge=1)
    mavlink_recv_timeout_s: float = Field(constants.MAVLINK_RECV_TIMEOUT_S, gt=0)
    mavlink_reconnect_delay_s: float = Field(constants.MAVLINK_RECONNECT_DELAY_S, gt=0)

    # Penyimpanan
    data_dir: Path = BACKEND_DIR / "data"
    log_dir: Path = BACKEND_DIR / "logs"
    log_level: str = "INFO"

    # WebSocket /ws (detik antar kiriman; 0.2 = 5x per detik)
    ws_interval_s: float = Field(0.2, gt=0)

    # CORS: daftar origin dipisah koma, atau "*" untuk semua
    cors_origins: str = "*"

    # Kamera
    camera_index: int = 0
    camera_width: int = Field(640, gt=0)
    camera_height: int = Field(480, gt=0)
    camera_fps: float = Field(10.0, gt=0)

    # MQTT (broker bisa Mosquitto di Raspi ini sendiri atau broker lain di jaringan)
    mqtt_enabled: bool = True
    mqtt_host: str = "localhost"
    mqtt_port: int = Field(1883, ge=1, le=65535)
    # Port WebSocket di broker. Dipakai browser (mqtt.js); backend hanya memberitahukannya
    # lewat GET /mqtt supaya dashboard tidak perlu menebak.
    mqtt_ws_port: int = Field(9001, ge=1, le=65535)
    mqtt_username: str | None = None
    mqtt_password: SecretStr | None = None
    mqtt_tls: bool = False
    mqtt_ca_cert: Path | None = None  # kosong = pakai sertifikat CA bawaan sistem
    mqtt_client_id: str | None = None  # kosong = "<device_id>-backend"
    mqtt_keepalive_s: int = Field(30, ge=5)
    # Topik dasar = <prefix>/<device_id>, contoh: seeder/drone1
    mqtt_topic_prefix: str = "seeder"
    mqtt_device_id: str = "drone1"
    # Jeda kirim status ke topik <base>/status (detik)
    mqtt_publish_interval_s: float = Field(0.5, gt=0)
    # false = hanya kirim data, perintah (drop, tes thruster, dll) dari MQTT diabaikan
    mqtt_commands_enabled: bool = True

    @field_validator("mqtt_topic_prefix", "mqtt_device_id")
    @classmethod
    def _valid_topic_part(cls, value: str) -> str:
        """Satu potong topik: tanpa spasi dan tanpa karakter khusus MQTT (/ # +)."""
        if not value or any(ch in value for ch in "/#+$") or any(ch.isspace() for ch in value):
            raise ValueError("harus diisi, tanpa spasi dan tanpa karakter / # + $")
        return value

    @property
    def config_path(self) -> Path:
        return self.data_dir / "config.json"

    @property
    def drops_path(self) -> Path:
        return self.data_dir / "drops.json"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def mqtt_base_topic(self) -> str:
        return f"{self.mqtt_topic_prefix}/{self.mqtt_device_id}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
