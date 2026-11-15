from pydantic import BaseModel


class MqttTopicsInfo(BaseModel):
    """Semua topik MQTT, supaya dashboard tidak perlu menulis nama topik manual."""

    online: str  # "online" / "offline" (retained)
    status: str  # status lengkap, isinya sama dengan GET /status
    drop_event: str  # satu pesan setiap ada drop
    response: str  # hasil setiap perintah yang dikirim lewat MQTT
    commands: dict[str, str]  # nama perintah -> topik tujuan


class MqttInfo(BaseModel):
    """Isi `GET /mqtt`."""

    enabled: bool
    commands_enabled: bool
    connected: bool  # backend sedang tersambung ke broker
    host: str  # alamat broker menurut backend (kalau localhost, pakai alamat Raspi)
    port: int  # port MQTT biasa (1883)
    ws_port: int  # port MQTT lewat WebSocket, untuk browser (9001)
    base_topic: str
    topics: MqttTopicsInfo
