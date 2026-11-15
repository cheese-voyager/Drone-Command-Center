"""MQTT: kirim status drone ke broker dan terima perintah dari dashboard/aplikasi.

Topik (default `seeder/drone1/...`, daftar lengkap ada di README):

    <base>/online           retained  "online" / "offline" (offline otomatis lewat Last Will)
    <base>/status           status lengkap (JSON sama dengan GET /status), tiap beberapa detik
    <base>/drop/event       titik drop, dikirim setiap ada drop (dari MQTT maupun REST)
    <base>/response         hasil setiap perintah yang masuk
    <base>/cmd/<perintah>   PERINTAH masuk: drop, drop-config, seed-load, battery,
                            thruster-test, thruster-stop

Service lain tidak tahu soal MQTT. Perintah dari MQTT memanggil service yang sama dengan
endpoint REST, jadi semua aturan keselamatan (batas thrust, drone harus terhubung, dst.) sama.
"""
import json
import queue
import threading
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError

from app.core.config import Settings
from app.core.constants import (
    MQTT_COMMAND_QUEUE_SIZE,
    MQTT_MAX_PAYLOAD_BYTES,
    MQTT_PRIORITY_COMMANDS,
    MQTT_RECONNECT_MAX_S,
    MQTT_RECONNECT_MIN_S,
    MQTT_STOP_TIMEOUT_S,
)
from app.core.exceptions import AppError
from app.core.logger import get_logger
from app.schemas.battery import BatteryConfig
from app.schemas.drop import DropConfigRequest, DropRecord
from app.schemas.mqtt import MqttInfo, MqttTopicsInfo
from app.schemas.seed import SeedLoadRequest
from app.schemas.thruster import ThrusterStopResponse, ThrusterTestRequest
from app.services.battery_service import BatteryService
from app.services.drone_service import DroneService
from app.services.drop_service import DropService
from app.services.seed_service import SeedService
from app.services.thruster_service import ThrusterService

log = get_logger("mqtt")

# Klien MQTT cukup mengikuti sebagian kecil API paho-mqtt (lihat tests/mocks/fake_mqtt.py).
MqttClientFactory = Callable[[str], Any]

ONLINE = "online"
OFFLINE = "offline"


def create_client(client_id: str) -> Any:
    """Klien paho-mqtt asli. MQTT 3.1.1 dan sesi bersih: perintah lama tidak dikirim ulang
    oleh broker setelah backend tersambung kembali."""
    import paho.mqtt.client as mqtt

    return mqtt.Client(
        mqtt.CallbackAPIVersion.VERSION2,
        client_id=client_id,
        protocol=mqtt.MQTTv311,
        clean_session=True,
    )


@dataclass(frozen=True)
class MqttTopics:
    base: str
    online: str
    status: str
    drop_event: str
    response: str
    command_prefix: str  # "<base>/cmd/"

    @classmethod
    def build(cls, prefix: str, device_id: str) -> "MqttTopics":
        base = f"{prefix}/{device_id}"
        return cls(
            base=base,
            online=f"{base}/online",
            status=f"{base}/status",
            drop_event=f"{base}/drop/event",
            response=f"{base}/response",
            command_prefix=f"{base}/cmd/",
        )

    def command(self, name: str) -> str:
        return self.command_prefix + name

    @property
    def command_filter(self) -> str:
        return self.command_prefix + "+"


class _CommandError(Exception):
    """Kesalahan pada perintah MQTT itu sendiri (bukan pada drone)."""

    def __init__(self, code: str, detail: str):
        self.code = code
        self.detail = detail
        super().__init__(detail)


@dataclass(frozen=True)
class _Command:
    model: type[BaseModel] | None  # bentuk payload; None = perintah tanpa isian
    run: Callable[[Any], Any]


class MqttService:
    def __init__(
        self,
        settings: Settings,
        drone: DroneService,
        battery: BatteryService,
        seeds: SeedService,
        drops: DropService,
        thruster: ThrusterService,
        client_factory: MqttClientFactory | None = None,
    ):
        self._settings = settings
        self._drone = drone
        self._factory = client_factory or create_client
        self.topics = MqttTopics.build(settings.mqtt_topic_prefix, settings.mqtt_device_id)

        # nama perintah -> (bentuk payload, fungsi yang dijalankan). Sama persis dengan REST.
        self._commands: dict[str, _Command] = {
            "drop": _Command(None, lambda _: drops.drop()),
            "drop-config": _Command(DropConfigRequest, drops.update_config),
            "seed-load": _Command(SeedLoadRequest, lambda req: seeds.load(req.loaded)),
            "battery": _Command(BatteryConfig, battery.configure),
            "thruster-test": _Command(
                ThrusterTestRequest,
                lambda req: thruster.test(req.thrust_percent, req.duration_s, req.target),
            ),
            "thruster-stop": _Command(
                None, lambda _: ThrusterStopResponse(stopped=thruster.stop())
            ),
        }

        self._client: Any = None
        self._connected = threading.Event()
        self._stop = threading.Event()
        self._inbox: queue.Queue[tuple[str, bytes]] = queue.Queue(MQTT_COMMAND_QUEUE_SIZE)
        self._threads: list[threading.Thread] = []

    # ---------- Hidup-mati ----------
    @property
    def enabled(self) -> bool:
        return self._settings.mqtt_enabled

    @property
    def is_connected(self) -> bool:
        return self._connected.is_set()

    def start(self) -> None:
        """Mulai tersambung ke broker di background. Aman kalau broker belum menyala:
        backend tetap jalan dan mencoba lagi sampai berhasil."""
        s = self._settings
        if not s.mqtt_enabled:
            log.info("MQTT_ENABLED=false: MQTT dimatikan")
            return
        if self._client is not None:
            return

        client = self._factory(s.mqtt_client_id or f"{s.mqtt_device_id}-backend")
        if s.mqtt_username:
            password = s.mqtt_password.get_secret_value() if s.mqtt_password else None
            client.username_pw_set(s.mqtt_username, password)
        if s.mqtt_tls:
            client.tls_set(ca_certs=str(s.mqtt_ca_cert) if s.mqtt_ca_cert else None)
        # Last Will: kalau backend mati mendadak, broker yang menandai "offline"
        client.will_set(self.topics.online, OFFLINE, qos=1, retain=True)
        client.reconnect_delay_set(MQTT_RECONNECT_MIN_S, MQTT_RECONNECT_MAX_S)
        client.on_connect = self._on_connect
        client.on_disconnect = self._on_disconnect
        client.on_message = self._on_message

        self._client = client
        self._stop.clear()
        log.info("Menghubungkan ke broker MQTT %s:%s", s.mqtt_host, s.mqtt_port)
        client.connect_async(s.mqtt_host, s.mqtt_port, s.mqtt_keepalive_s)
        client.loop_start()

        self._threads = [
            threading.Thread(target=self._publish_loop, name="mqtt-publisher", daemon=True),
            threading.Thread(target=self._command_loop, name="mqtt-commands", daemon=True),
        ]
        for thread in self._threads:
            thread.start()

    def stop(self) -> None:
        client = self._client
        if client is None:
            return
        self._stop.set()
        for thread in self._threads:
            thread.join(2.0)
        self._threads = []

        try:
            if self._connected.is_set():  # pamit baik-baik, bukan lewat Last Will
                info = client.publish(self.topics.online, OFFLINE, qos=1, retain=True)
                info.wait_for_publish(MQTT_STOP_TIMEOUT_S)
            client.disconnect()
            client.loop_stop()
        except Exception:
            log.exception("Gagal menutup koneksi MQTT dengan rapi")
        self._connected.clear()
        self._client = None

    # ---------- Callback broker (jalan di thread jaringan paho) ----------
    def _on_connect(self, client, userdata, flags, reason_code, properties=None) -> None:
        failed = getattr(reason_code, "is_failure", reason_code not in (0, None))
        if failed:
            log.error("Broker MQTT menolak koneksi: %s", reason_code)
            return
        self._connected.set()
        log.info("MQTT terhubung ke %s:%s", self._settings.mqtt_host, self._settings.mqtt_port)
        # Sesi bersih: langganan harus dibuat ulang setiap kali tersambung
        if self._settings.mqtt_commands_enabled:
            client.subscribe(self.topics.command_filter, qos=1)
        client.publish(self.topics.online, ONLINE, qos=1, retain=True)

    def _on_disconnect(self, client, userdata, disconnect_flags=None, reason_code=None, *args):
        self._connected.clear()
        if not self._stop.is_set():
            log.warning("MQTT terputus (%s). Mencoba tersambung lagi...", reason_code)

    def _on_message(self, client, userdata, msg) -> None:
        if not self._settings.mqtt_commands_enabled:
            return
        prefix = self.topics.command_prefix
        if not msg.topic.startswith(prefix):
            return
        name = msg.topic[len(prefix) :]

        # Pesan retained = pesan lama yang disimpan broker. Menjalankannya setiap backend
        # tersambung berarti thruster bisa menyala sendiri, jadi selalu diabaikan.
        if msg.retain:
            log.warning("Perintah retained '%s' diabaikan (demi keselamatan)", name)
            return
        if len(msg.payload) > MQTT_MAX_PAYLOAD_BYTES:
            self._respond(name, None, error=("payload_too_large", "Payload terlalu besar"))
            return

        if name in MQTT_PRIORITY_COMMANDS:
            self._execute(name, msg.payload)  # stop darurat tidak boleh antre
            return
        try:
            self._inbox.put_nowait((name, msg.payload))
        except queue.Full:
            log.error("Antrean perintah MQTT penuh, perintah '%s' dibuang", name)
            self._respond(name, None, error=("queue_full", "Terlalu banyak perintah masuk"))

    # ---------- Kirim ----------
    def _publish(self, topic: str, payload: str, qos: int = 0, retain: bool = False) -> bool:
        client = self._client
        if client is None or not self._connected.is_set():
            return False
        try:
            client.publish(topic, payload, qos=qos, retain=retain)
            return True
        except Exception:
            log.exception("Gagal publish ke %s", topic)
            return False

    def publish_status(self) -> bool:
        """Kirim status lengkap sekarang (QoS 0: data baru datang terus, yang lama tak penting)."""
        return self._publish(self.topics.status, self._drone.get_status().model_dump_json())

    def publish_drop(self, record: DropRecord) -> None:
        """Dipanggil DropService setiap ada drop, dari REST maupun dari MQTT."""
        self._publish(self.topics.drop_event, record.model_dump_json(), qos=1)

    def _publish_loop(self) -> None:
        interval = self._settings.mqtt_publish_interval_s
        while not self._stop.wait(interval):
            try:
                self.publish_status()
            except Exception:
                log.exception("Gagal mengirim status lewat MQTT")

    # ---------- Perintah masuk ----------
    def _command_loop(self) -> None:
        """Perintah dijalankan satu per satu (berurutan) di thread sendiri, supaya thread
        jaringan paho tetap bebas membalas keepalive."""
        while not self._stop.is_set():
            try:
                name, raw = self._inbox.get(timeout=0.2)
            except queue.Empty:
                continue
            self._execute(name, raw)

    def _execute(self, name: str, raw: bytes) -> None:
        request_id: str | int | None = None
        try:
            body = self._parse_body(raw)
            rid = body.pop("request_id", None)
            request_id = rid if isinstance(rid, (str, int)) and not isinstance(rid, bool) else None

            command = self._commands.get(name)
            if command is None:
                raise _CommandError("unknown_command", f"Perintah tidak dikenal: {name}")
            arg = command.model.model_validate(body) if command.model else None
            result = command.run(arg)
            data = result.model_dump(mode="json") if isinstance(result, BaseModel) else None
            self._respond(name, request_id, data=data)
        except _CommandError as exc:
            self._respond(name, request_id, error=(exc.code, exc.detail))
        except ValidationError as exc:
            detail = "; ".join(
                f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()
            )
            self._respond(name, request_id, error=("validation_error", detail))
        except AppError as exc:
            self._respond(name, request_id, error=(exc.code, exc.message))
        except Exception:
            log.exception("Perintah MQTT '%s' gagal", name)
            self._respond(name, request_id, error=("internal_error", "Kesalahan internal"))

    @staticmethod
    def _parse_body(raw: bytes) -> dict:
        """Payload kosong = `{}`. Selain itu harus JSON object."""
        text = raw.decode("utf-8", errors="replace").strip()
        if not text:
            return {}
        try:
            body = json.loads(text)
        except ValueError as exc:
            raise _CommandError("invalid_payload", "Payload bukan JSON yang valid") from exc
        if not isinstance(body, dict):
            raise _CommandError("invalid_payload", "Payload harus berupa JSON object")
        return body

    def _respond(
        self,
        name: str,
        request_id: str | int | None,
        data: dict | None = None,
        error: tuple[str, str] | None = None,
    ) -> None:
        """Hasil perintah ke `<base>/response`. Bentuk error sama dengan REST: code + detail."""
        message: dict[str, Any] = {"cmd": name, "ok": error is None}
        if request_id is not None:
            message["request_id"] = request_id
        if error is None:
            message["data"] = data
        else:
            message["error"] = {"code": error[0], "detail": error[1]}
        self._publish(self.topics.response, json.dumps(message), qos=1)

    # ---------- Info untuk dashboard (GET /mqtt) ----------
    def info(self) -> MqttInfo:
        s = self._settings
        t = self.topics
        return MqttInfo(
            enabled=s.mqtt_enabled,
            commands_enabled=s.mqtt_commands_enabled,
            connected=self.is_connected,
            host=s.mqtt_host,
            port=s.mqtt_port,
            ws_port=s.mqtt_ws_port,
            base_topic=t.base,
            topics=MqttTopicsInfo(
                online=t.online,
                status=t.status,
                drop_event=t.drop_event,
                response=t.response,
                commands={name: t.command(name) for name in self._commands},
            ),
        )
