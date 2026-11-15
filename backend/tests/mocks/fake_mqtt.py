"""Klien MQTT tiruan untuk tes: tidak butuh broker. Mengikuti sebagian kecil API paho-mqtt."""
import json
from types import SimpleNamespace
from typing import Any


class _PublishInfo:
    def wait_for_publish(self, timeout: float | None = None) -> None:
        return None


class FakeMqttClient:
    def __init__(self, client_id: str = ""):
        self.client_id = client_id
        self.credentials: tuple[str, str | None] | None = None
        self.tls_args: dict | None = None
        self.will: tuple[str, str, int, bool] | None = None
        self.connect_args: tuple[str, int, int] | None = None
        self.loop_started = False
        self.disconnected = False
        self.subscriptions: list[tuple[str, int]] = []
        self.published: list[tuple[str, str, int, bool]] = []  # topik, payload, qos, retain
        self.on_connect = None
        self.on_disconnect = None
        self.on_message = None

    # ---- antarmuka paho yang dipakai MqttService ----
    def username_pw_set(self, username: str, password: str | None = None) -> None:
        self.credentials = (username, password)

    def tls_set(self, **kwargs: Any) -> None:
        self.tls_args = kwargs

    def will_set(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> None:
        self.will = (topic, payload, qos, retain)

    def reconnect_delay_set(self, min_delay: int = 1, max_delay: int = 120) -> None:
        pass

    def connect_async(self, host: str, port: int = 1883, keepalive: int = 60) -> None:
        self.connect_args = (host, port, keepalive)

    def loop_start(self) -> None:
        self.loop_started = True

    def loop_stop(self) -> None:
        self.loop_started = False

    def disconnect(self) -> None:
        self.disconnected = True

    def subscribe(self, topic: str, qos: int = 0) -> None:
        self.subscriptions.append((topic, qos))

    def publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False):
        self.published.append((topic, payload, qos, retain))
        return _PublishInfo()

    # ---- bantuan untuk tes ----
    def simulate_connect(self, failed: bool = False) -> None:
        self.on_connect(self, None, {}, SimpleNamespace(is_failure=failed), None)

    def simulate_disconnect(self) -> None:
        self.on_disconnect(self, None, {}, SimpleNamespace(is_failure=True), None)

    def send(self, topic: str, payload: str | bytes | dict = "", retain: bool = False) -> None:
        """Pura-puranya ada pesan masuk dari broker."""
        if isinstance(payload, dict):
            payload = json.dumps(payload)
        if isinstance(payload, str):
            payload = payload.encode()
        msg = SimpleNamespace(topic=topic, payload=payload, retain=retain, qos=1)
        self.on_message(self, None, msg)

    def on_topic(self, topic: str) -> list[tuple[str, int, bool]]:
        """Semua pesan yang dikirim backend ke `topic`: (payload, qos, retain)."""
        return [(p, q, r) for t, p, q, r in self.published if t == topic]

    def json_on(self, topic: str) -> list[dict]:
        return [json.loads(p) for p, _, _ in self.on_topic(topic)]
