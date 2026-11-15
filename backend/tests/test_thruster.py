import time

import pytest

from app.core.exceptions import InvalidParameterError
from app.services.thruster_service import thrust_to_pwm, validate_duration, validate_thrust


@pytest.mark.parametrize(
    "thrust,pwm",
    [(0, 1000), (20, 1200), (50, 1500), (70, 1700), (100, 2000)],
)
def test_thrust_ke_pwm(thrust, pwm):
    assert thrust_to_pwm(thrust, 1000, 2000) == pwm


def test_validasi_thrust():
    validate_thrust(0)
    validate_thrust(100)
    for bad in (-0.1, 100.1):
        with pytest.raises(InvalidParameterError, match="thrust harus 0-100"):
            validate_thrust(bad)


def test_validasi_durasi():
    validate_duration(0.1)
    validate_duration(10)
    for bad in (0, -1, 10.1):
        with pytest.raises(InvalidParameterError, match="duration harus 0-10 detik"):
            validate_duration(bad)


def test_tes_thruster_berhasil(client, connected, fake_link, container, wait_until):
    r = client.post("/thruster/test", json={"thrust_percent": 40, "duration_s": 0.05})

    assert r.status_code == 200
    assert r.json() == {
        "target": "seeder",
        "thrust": 40,
        "duration": 0.05,
        "pwm": 1400,
        "total_duration": None,
    }
    assert wait_until(lambda: not container.thruster.busy)
    assert fake_link.servo_commands == [(9, 1400), (9, 1000)]


def test_nilai_awal_tes_kecil(client, connected, fake_link, container):
    """Tanpa body, tes mulai dari thrust 20% selama 2 detik."""
    container.config.update_section("drop", {"servo_channel": 9})
    r = client.post("/thruster/test", json={})
    body = r.json()
    assert (body["target"], body["thrust"], body["duration"], body["pwm"]) == (
        "seeder", 20, 2, 1200
    )
    client.post("/thruster/stop")


def test_tes_tidak_mengurangi_benih_dan_tidak_dicatat(client, connected, container, wait_until):
    client.post("/seed/load", json={"loaded": 10})
    client.post("/thruster/test", json={"thrust_percent": 30, "duration_s": 0.05})
    assert wait_until(lambda: not container.thruster.busy)

    assert client.get("/status").json()["seed"]["dropped"] == 0
    assert client.get("/drops").json() == []


@pytest.mark.parametrize(
    "body",
    [
        {"thrust_percent": 101},
        {"thrust_percent": -5},
        {"duration_s": 0},
        {"duration_s": 10.5},
    ],
)
def test_tes_di_luar_batas_aman_ditolak(client, connected, fake_link, body):
    assert client.post("/thruster/test", json=body).status_code == 422
    assert fake_link.servo_commands == []


def test_tes_ditolak_kalau_pixhawk_belum_terhubung(client, fake_link):
    r = client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 1})
    assert r.status_code == 400
    assert r.json()["detail"] == "Pixhawk belum terhubung"
    assert fake_link.servo_commands == []


def test_tes_ditolak_saat_thruster_berjalan(client, connected, container, wait_until):
    first = client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 0.5})
    assert first.status_code == 200
    r = client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 0.5})
    assert r.status_code == 400
    assert r.json()["detail"] == "Thruster sedang berjalan"
    assert wait_until(lambda: not container.thruster.busy)


def test_tes_ditolak_saat_drop_berjalan(client, connected, container, wait_until):
    client.post("/seed/load", json={"loaded": 5})
    client.post("/drop/config", json={"duration_s": 0.5})
    assert client.post("/drop").status_code == 200
    r = client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 1})
    assert r.status_code == 400
    assert r.json()["detail"] == "Thruster sedang berjalan"
    assert wait_until(lambda: not container.thruster.busy)


def test_stop_darurat_menghentikan_segera(client, connected, fake_link, container, wait_until):
    client.post("/thruster/test", json={"thrust_percent": 80, "duration_s": 5})
    assert container.thruster.busy

    started = time.monotonic()
    r = client.post("/thruster/stop")

    assert r.status_code == 200
    assert r.json() == {"stopped": True}
    assert wait_until(lambda: not container.thruster.busy, timeout=1.0)
    assert time.monotonic() - started < 1.0  # tidak menunggu 5 detik
    assert fake_link.servo_commands[0] == (9, 1800)
    assert fake_link.servo_commands[-1] == (9, 1000)


def test_stop_tanpa_koneksi_tetap_aman(client):
    r = client.post("/thruster/stop")
    assert r.status_code == 200
    assert r.json() == {"stopped": True}


def test_stop_melapor_gagal_kalau_perintah_tidak_terkirim(client, connected, fake_link):
    fake_link.fail_servo = True
    r = client.post("/thruster/stop")
    assert r.status_code == 200
    assert r.json() == {"stopped": False}


def test_bisa_dipakai_lagi_setelah_stop(client, connected, fake_link, container, wait_until):
    client.post("/thruster/test", json={"thrust_percent": 80, "duration_s": 5})
    client.post("/thruster/stop")
    assert wait_until(lambda: not container.thruster.busy)

    r = client.post("/thruster/test", json={"thrust_percent": 10, "duration_s": 0.05})
    assert r.status_code == 200
    assert wait_until(lambda: not container.thruster.busy)
    assert fake_link.servo_commands[-2:] == [(9, 1100), (9, 1000)]


def test_perintah_nyala_gagal_melepas_thruster(client, connected, fake_link, container):
    fake_link.fail_servo = True
    r = client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 1})
    assert r.status_code == 502
    assert container.thruster.busy is False
