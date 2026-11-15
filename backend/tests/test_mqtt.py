import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app
from tests.mocks.fake_mavlink import heartbeat
from tests.mocks.fake_mqtt import FakeMqttClient

BASE = "seeder/drone1"
RESPONSE = f"{BASE}/response"
STATUS = f"{BASE}/status"
ONLINE = f"{BASE}/online"
DROP_EVENT = f"{BASE}/drop/event"


@pytest.fixture
def fake_mqtt():
    return FakeMqttClient()


@pytest.fixture
def make_app(make_settings, fake_link, fake_mqtt):
    """Aplikasi dengan MQTT menyala tapi klien tiruan (tanpa broker). Mengembalikan TestClient."""
    stack = []

    def _make(**overrides):
        overrides.setdefault("mqtt_enabled", True)
        overrides.setdefault("mqtt_publish_interval_s", 0.02)

        def factory(client_id):
            fake_mqtt.client_id = client_id
            return fake_mqtt

        app = create_app(make_settings(**overrides), link_factory=lambda c: fake_link,
                         mqtt_factory=factory)
        client = TestClient(app)
        client.__enter__()
        stack.append(client)
        return client

    yield _make
    for c in stack:
        c.__exit__(None, None, None)


@pytest.fixture
def mqtt_app(make_app, fake_mqtt):
    """Aplikasi dengan MQTT yang sudah tersambung ke broker tiruan."""
    client = make_app()
    fake_mqtt.simulate_connect()
    return client


@pytest.fixture
def connected(mqtt_app, fake_link):
    """Drone di aplikasi MQTT ini sudah terhubung ke Pixhawk tiruan (fixture `connected`
    di conftest.py memakai aplikasi lain, jadi tidak bisa dipakai di sini)."""
    drone = mqtt_app.app.state.container.drone
    drone.attach_link(fake_link)
    drone.handle_message(heartbeat())
    return drone


def answer(fake_mqtt, wait_until, count=1):
    """Tunggu sampai ada `count` jawaban di topik response, lalu kembalikan yang terakhir."""
    assert wait_until(lambda: len(fake_mqtt.json_on(RESPONSE)) >= count), "tidak ada response"
    return fake_mqtt.json_on(RESPONSE)[count - 1]


# ---------- Koneksi ----------
def test_mati_kalau_mqtt_enabled_false(make_app, fake_mqtt):
    client = make_app(mqtt_enabled=False)
    assert fake_mqtt.connect_args is None
    info = client.get("/mqtt").json()
    assert info["enabled"] is False and info["connected"] is False


def test_start_memakai_pengaturan_dan_last_will(make_app, fake_mqtt):
    make_app(
        mqtt_host="broker.lokal", mqtt_port=1884, mqtt_username="seeder",
        mqtt_password="rahasia", mqtt_keepalive_s=20,
    )
    assert fake_mqtt.client_id == "drone1-backend"
    assert fake_mqtt.connect_args == ("broker.lokal", 1884, 20)
    assert fake_mqtt.credentials == ("seeder", "rahasia")
    assert fake_mqtt.loop_started
    assert fake_mqtt.will == (ONLINE, "offline", 1, True)  # broker menandai offline kalau mati


def test_tls_dan_client_id(make_app, fake_mqtt):
    make_app(mqtt_tls=True, mqtt_client_id="raspi-a")
    assert fake_mqtt.tls_args == {"ca_certs": None}
    assert fake_mqtt.client_id == "raspi-a"


def test_tersambung_subscribe_perintah_dan_kirim_online(make_app, fake_mqtt):
    make_app()
    assert fake_mqtt.subscriptions == []  # belum tersambung, belum subscribe
    fake_mqtt.simulate_connect()
    assert fake_mqtt.subscriptions == [(f"{BASE}/cmd/+", 1)]
    assert fake_mqtt.on_topic(ONLINE) == [("online", 1, True)]  # retained


def test_koneksi_ditolak_broker_tidak_dianggap_tersambung(make_app, fake_mqtt):
    client = make_app()
    fake_mqtt.simulate_connect(failed=True)
    assert client.get("/mqtt").json()["connected"] is False
    assert fake_mqtt.subscriptions == []


def test_perintah_dimatikan_tidak_subscribe_dan_diabaikan(make_app, fake_mqtt, container_of):
    client = make_app(mqtt_commands_enabled=False)
    fake_mqtt.simulate_connect()
    assert fake_mqtt.subscriptions == []
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 50})
    assert container_of(client).seeds.status().loaded == 0
    assert fake_mqtt.json_on(RESPONSE) == []


def test_terputus_lalu_tersambung_lagi_subscribe_ulang(mqtt_app, fake_mqtt):
    fake_mqtt.simulate_disconnect()
    assert mqtt_app.get("/mqtt").json()["connected"] is False
    fake_mqtt.simulate_connect()
    assert mqtt_app.get("/mqtt").json()["connected"] is True
    assert len(fake_mqtt.subscriptions) == 2  # sesi bersih: langganan dibuat ulang


# ---------- Kirim status ----------
def test_status_dikirim_berkala_isinya_sama_dengan_rest(mqtt_app, fake_mqtt, wait_until):
    assert wait_until(lambda: len(fake_mqtt.on_topic(STATUS)) >= 2)
    payload, qos, retain = fake_mqtt.on_topic(STATUS)[0]
    assert qos == 0 and retain is False  # data baru datang terus, tidak perlu retained
    sent = json.loads(payload)
    assert set(sent) == set(mqtt_app.get("/status").json())


def test_status_tidak_dikirim_saat_terputus(make_app, fake_mqtt):
    client = make_app()
    container = client.app.state.container
    assert container.mqtt.publish_status() is False  # belum tersambung
    assert fake_mqtt.on_topic(STATUS) == []


# ---------- Perintah ----------
def test_seed_load_lewat_mqtt(mqtt_app, fake_mqtt, container_of, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 120, "request_id": "a1"})
    r = answer(fake_mqtt, wait_until)
    assert r == {"cmd": "seed-load", "request_id": "a1", "ok": True,
                 "data": {"loaded": 120, "dropped": 0}}
    assert container_of(mqtt_app).seeds.status().loaded == 120


def test_response_dikirim_qos1_tidak_retained(mqtt_app, fake_mqtt, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 5})
    answer(fake_mqtt, wait_until)
    assert fake_mqtt.on_topic(RESPONSE)[0][1:] == (1, False)


def test_battery_dan_drop_config(mqtt_app, fake_mqtt, container_of, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/battery", {"capacity_mah": 16000, "cells": 6})
    fake_mqtt.send(f"{BASE}/cmd/drop-config", {"thrust_percent": 55, "duration_s": 2})
    first = answer(fake_mqtt, wait_until, 1)
    second = answer(fake_mqtt, wait_until, 2)  # diproses berurutan
    assert first["cmd"] == "battery" and first["data"]["capacity_mah"] == 16000
    assert second["cmd"] == "drop-config" and second["data"]["thrust_percent"] == 55
    assert container_of(mqtt_app).config.section("drop")["duration_s"] == 2


def test_drop_lewat_mqtt_menyalakan_servo_dan_kirim_event(
    mqtt_app, fake_mqtt, fake_link, connected, container_of, wait_until
):
    container_of(mqtt_app).seeds.load(10)
    fake_mqtt.send(f"{BASE}/cmd/drop", "")  # payload kosong boleh
    r = answer(fake_mqtt, wait_until)
    assert r["ok"] is True and r["cmd"] == "drop" and r["data"]["thrust"] == 70
    assert fake_link.servo_commands[0] == (9, 1700)  # thrust 70% -> PWM 1700
    event = fake_mqtt.json_on(DROP_EVENT)[0]
    assert event["thrust"] == 70 and set(event) == {"time", "lat", "lon", "thrust", "duration"}
    assert fake_mqtt.on_topic(DROP_EVENT)[0][1:] == (1, False)
    container_of(mqtt_app).thruster.stop()


def test_drop_lewat_rest_juga_kirim_event(mqtt_app, fake_mqtt, connected, container_of):
    container_of(mqtt_app).seeds.load(10)
    assert mqtt_app.post("/drop").status_code == 200
    assert len(fake_mqtt.json_on(DROP_EVENT)) == 1
    container_of(mqtt_app).thruster.stop()


def test_pendengar_drop_yang_error_tidak_menggagalkan_drop(
    mqtt_app, connected, container_of
):
    container = container_of(mqtt_app)
    container.seeds.load(10)

    def rusak(_record):
        raise RuntimeError("boom")

    container.drops.add_listener(rusak)
    assert mqtt_app.post("/drop").status_code == 200
    assert container.seeds.status().dropped == 1
    container.thruster.stop()


def test_thruster_test_seeder(mqtt_app, fake_mqtt, fake_link, connected, container_of, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/thruster-test", {"thrust_percent": 20, "duration_s": 1})
    r = answer(fake_mqtt, wait_until)
    assert r["ok"] and r["data"]["target"] == "seeder" and r["data"]["pwm"] == 1200
    container_of(mqtt_app).thruster.stop()


def test_thruster_stop_langsung_walau_antrean_sibuk(
    mqtt_app, fake_mqtt, fake_link, connected, container_of
):
    """Stop darurat dijalankan di thread penerima, tidak antre di belakang perintah lain."""
    container = container_of(mqtt_app)
    container.thruster.reserve()
    container.thruster.start_pulse(50, 5)
    fake_link.servo_commands.clear()
    fake_mqtt.send(f"{BASE}/cmd/thruster-stop", {"request_id": 7})
    # langsung (sinkron) kembali ke PWM minimum, tanpa menunggu thread perintah
    assert fake_link.servo_commands[0] == (9, 1000)
    assert fake_mqtt.json_on(RESPONSE)[-1] == {
        "cmd": "thruster-stop", "request_id": 7, "ok": True, "data": {"stopped": True},
    }


# ---------- Error ----------
def test_drop_tanpa_pixhawk_ditolak_dengan_kode_yang_sama_seperti_rest(
    mqtt_app, fake_mqtt, container_of, wait_until
):
    container_of(mqtt_app).seeds.load(10)
    fake_mqtt.send(f"{BASE}/cmd/drop", {"request_id": "x"})
    r = answer(fake_mqtt, wait_until)
    assert r == {"cmd": "drop", "request_id": "x", "ok": False,
                 "error": {"code": "drone_not_connected", "detail": "Pixhawk belum terhubung"}}
    assert fake_mqtt.json_on(DROP_EVENT) == []


def test_benih_kurang(mqtt_app, fake_mqtt, connected, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/drop")
    assert answer(fake_mqtt, wait_until)["error"]["code"] == "not_enough_seeds"


def test_nilai_di_luar_batas_ditolak(mqtt_app, fake_mqtt, container_of, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/drop-config", {"thrust_percent": 150})
    r = answer(fake_mqtt, wait_until)
    assert r["ok"] is False and r["error"]["code"] == "validation_error"
    assert "thrust_percent" in r["error"]["detail"]
    assert container_of(mqtt_app).config.section("drop")["thrust_percent"] == 70  # tidak berubah


def test_tes_motor_lebih_dari_30_persen_ditolak(mqtt_app, fake_mqtt, connected, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/thruster-test", {"target": "motor_1", "thrust_percent": 80})
    assert answer(fake_mqtt, wait_until)["error"]["code"] == "invalid_parameter"


@pytest.mark.parametrize("payload", ["bukan json", "[1, 2]", "42"])
def test_payload_rusak(mqtt_app, fake_mqtt, wait_until, payload):
    fake_mqtt.send(f"{BASE}/cmd/seed-load", payload)
    assert answer(fake_mqtt, wait_until)["error"]["code"] == "invalid_payload"


def test_perintah_tidak_dikenal(mqtt_app, fake_mqtt, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/terbang", {"request_id": 3})
    r = answer(fake_mqtt, wait_until)
    assert r["error"]["code"] == "unknown_command" and r["request_id"] == 3


def test_request_id_selain_teks_atau_angka_diabaikan(mqtt_app, fake_mqtt, wait_until):
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 1, "request_id": {"a": 1}})
    assert "request_id" not in answer(fake_mqtt, wait_until)


def test_payload_terlalu_besar(mqtt_app, fake_mqtt):
    fake_mqtt.send(f"{BASE}/cmd/seed-load", "x" * 5000)
    assert fake_mqtt.json_on(RESPONSE)[0]["error"]["code"] == "payload_too_large"


def test_perintah_retained_tidak_pernah_dijalankan(mqtt_app, fake_mqtt, container_of):
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 99}, retain=True)
    assert container_of(mqtt_app).seeds.status().loaded == 0
    assert fake_mqtt.json_on(RESPONSE) == []


def test_pesan_di_luar_topik_perintah_diabaikan(mqtt_app, fake_mqtt):
    fake_mqtt.send(f"{BASE}/status", {"loaded": 99})
    fake_mqtt.send("seeder/drone2/cmd/seed-load", {"loaded": 99})
    assert fake_mqtt.json_on(RESPONSE) == []


def test_error_tak_terduga_dilaporkan_bukan_dibiarkan_diam(
    mqtt_app, fake_mqtt, container_of, wait_until, monkeypatch
):
    def meledak(_):
        raise RuntimeError("boom")

    monkeypatch.setattr(container_of(mqtt_app).seeds, "load", meledak)
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 5})
    assert answer(fake_mqtt, wait_until)["error"]["code"] == "internal_error"
    # perintah berikutnya tetap jalan
    monkeypatch.undo()
    fake_mqtt.send(f"{BASE}/cmd/seed-load", {"loaded": 6})
    assert answer(fake_mqtt, wait_until, 2)["ok"] is True


# ---------- Mati ----------
def test_backend_mati_mengirim_offline_dan_menutup_koneksi(make_app, fake_mqtt):
    client = make_app()
    fake_mqtt.simulate_connect()
    client.__exit__(None, None, None)
    assert fake_mqtt.on_topic(ONLINE)[-1] == ("offline", 1, True)
    assert fake_mqtt.disconnected and not fake_mqtt.loop_started
    client.__enter__()  # supaya fixture bisa menutup lagi tanpa error


# ---------- GET /mqtt ----------
def test_info_mqtt(mqtt_app, fake_mqtt):
    info = mqtt_app.get("/mqtt").json()
    assert info["enabled"] and info["commands_enabled"] and info["connected"]
    assert info["base_topic"] == BASE
    assert info["port"] == 1883 and info["ws_port"] == 9001
    assert info["topics"]["status"] == STATUS
    assert info["topics"]["commands"]["drop"] == f"{BASE}/cmd/drop"
    assert set(info["topics"]["commands"]) == {
        "drop", "drop-config", "seed-load", "battery", "thruster-test", "thruster-stop",
    }
    assert "password" not in json.dumps(info).lower()


# ---------- Pengaturan ----------
@pytest.mark.parametrize("bad", ["", "a/b", "a b", "a#", "a+", "$SYS"])
def test_device_id_tidak_boleh_mengandung_karakter_topik(bad):
    with pytest.raises(ValidationError):
        Settings(_env_file=None, mqtt_device_id=bad)


def test_topik_dasar_dari_prefix_dan_device_id():
    s = Settings(_env_file=None, mqtt_topic_prefix="kebun", mqtt_device_id="d2")
    assert s.mqtt_base_topic == "kebun/d2"


def test_password_tidak_tampil_di_repr():
    s = Settings(_env_file=None, mqtt_password="rahasia")
    assert "rahasia" not in repr(s)
