import json

import pytest

from tests.mocks.fake_mavlink import global_position


@pytest.fixture
def siap_drop(client, connected, container, fake_link):
    """Drone terhubung, punya GPS, 10 benih, durasi drop singkat supaya tes cepat."""
    client.post("/seed/load", json={"loaded": 10})
    client.post("/drop/config", json={"thrust_percent": 60, "duration_s": 0.05})
    connected.handle_message(global_position(-6.9175, 107.6191, 12.5))
    return client


def test_atur_drop_config_sebagian(client):
    r = client.post("/drop/config", json={"thrust_percent": 55})
    assert r.status_code == 200
    body = r.json()
    assert body["thrust_percent"] == 55
    assert body["duration_s"] == 1.5  # tidak diubah
    assert body["servo_channel"] == 9
    assert body["pwm_min"] == 1000 and body["pwm_max"] == 2000

    r = client.post("/drop/config", json={"duration_s": 2})
    assert r.json()["thrust_percent"] == 55  # tidak diubah
    assert r.json()["duration_s"] == 2


def test_drop_config_tersimpan_ke_file(client, settings):
    client.post("/drop/config", json={"thrust_percent": 40, "duration_s": 3})
    saved = json.loads(settings.config_path.read_text())["drop"]
    assert saved["thrust_percent"] == 40
    assert saved["duration_s"] == 3


@pytest.mark.parametrize(
    "body",
    [
        {"thrust_percent": 150},
        {"thrust_percent": -1},
        {"duration_s": 0},
        {"duration_s": 11},
    ],
)
def test_drop_config_di_luar_batas_ditolak(client, body):
    assert client.post("/drop/config", json=body).status_code == 422


def test_drop_berhasil(siap_drop, fake_link, container, wait_until):
    r = siap_drop.post("/drop")

    assert r.status_code == 200
    body = r.json()
    assert body["lat"] == pytest.approx(-6.9175)
    assert body["lon"] == pytest.approx(107.6191)
    assert body["thrust"] == 60
    assert body["duration"] == 0.05
    assert body["time"] > 0

    # servo: nyala pada thrust 60% -> PWM 1600, lalu kembali ke PWM minimum
    assert wait_until(lambda: not container.thruster.busy)
    assert fake_link.servo_commands == [(9, 1600), (9, 1000)]


def test_drop_mengurangi_benih_dan_tercatat(siap_drop, container, wait_until, settings):
    siap_drop.post("/drop")
    assert wait_until(lambda: not container.thruster.busy)

    assert siap_drop.get("/status").json()["seed"] == {"loaded": 10, "dropped": 1, "remaining": 9}

    drops = siap_drop.get("/drops").json()
    assert len(drops) == 1
    assert drops[0]["lat"] == pytest.approx(-6.9175)

    # riwayat tersimpan ke file
    assert len(json.loads(settings.drops_path.read_text())) == 1


def test_drop_beberapa_kali(siap_drop, container, wait_until):
    for _ in range(3):
        assert siap_drop.post("/drop").status_code == 200
        assert wait_until(lambda: not container.thruster.busy)
    assert len(siap_drop.get("/drops").json()) == 3
    assert siap_drop.get("/status").json()["seed"]["dropped"] == 3


def test_seeds_per_drop_dipakai(siap_drop, container, wait_until):
    container.config.update_section("drop", {"seeds_per_drop": 3})
    siap_drop.post("/drop")
    assert wait_until(lambda: not container.thruster.busy)
    assert siap_drop.get("/status").json()["seed"]["dropped"] == 3


def test_drop_ditolak_kalau_pixhawk_belum_terhubung(client, fake_link):
    client.post("/seed/load", json={"loaded": 10})
    r = client.post("/drop")
    assert r.status_code == 400
    assert r.json() == {"detail": "Pixhawk belum terhubung", "code": "drone_not_connected"}
    assert client.get("/drops").json() == []
    assert fake_link.servo_commands == []


def test_drop_ditolak_kalau_benih_tidak_cukup(client, connected, container, fake_link):
    r = client.post("/drop")  # benih dimuat 0
    assert r.status_code == 400
    assert r.json()["detail"] == "Benih tidak cukup"
    assert fake_link.servo_commands == []
    assert client.get("/drops").json() == []
    assert container.thruster.busy is False  # hak pakai thruster dilepas lagi


def test_drop_ditolak_saat_drop_lain_berjalan(siap_drop, container, wait_until):
    siap_drop.post("/drop/config", json={"duration_s": 0.5})
    assert siap_drop.post("/drop").status_code == 200

    r = siap_drop.post("/drop")
    assert r.status_code == 400
    assert r.json()["detail"] == "Drop sedang berjalan"
    assert siap_drop.get("/status").json()["seed"]["dropped"] == 1  # hanya satu yang jalan

    assert wait_until(lambda: not container.thruster.busy)
    assert siap_drop.post("/drop").status_code == 200  # setelah selesai bisa lagi


def test_perintah_gagal_terkirim_tidak_mengurangi_benih(siap_drop, fake_link, container):
    fake_link.fail_servo = True

    r = siap_drop.post("/drop")

    assert r.status_code == 502
    assert r.json()["code"] == "mavlink_command_failed"
    assert siap_drop.get("/status").json()["seed"]["dropped"] == 0
    assert siap_drop.get("/drops").json() == []
    assert container.thruster.busy is False


def test_drop_tanpa_gps_mencatat_posisi_kosong(client, connected, container, wait_until):
    client.post("/seed/load", json={"loaded": 5})
    client.post("/drop/config", json={"duration_s": 0.05})
    r = client.post("/drop")
    assert r.status_code == 200
    assert r.json()["lat"] is None and r.json()["lon"] is None
    assert wait_until(lambda: not container.thruster.busy)


def test_pwm_mengikuti_rentang_config(siap_drop, container, fake_link, wait_until):
    container.config.update_section("drop", {"pwm_min": 1100, "pwm_max": 1900, "servo_channel": 10})
    siap_drop.post("/drop/config", json={"thrust_percent": 50})
    siap_drop.post("/drop")
    assert wait_until(lambda: not container.thruster.busy)
    assert fake_link.servo_commands == [(10, 1500), (10, 1100)]


def test_thrust_rusak_di_config_json_ditolak(siap_drop, container, fake_link):
    """Config.json yang diedit manual jadi 500% tidak boleh sampai ke servo."""
    container.config.update_section("drop", {"thrust_percent": 500})
    r = siap_drop.post("/drop")
    assert r.status_code == 400
    assert r.json()["detail"] == "thrust harus 0-100"
    assert fake_link.servo_commands == []
