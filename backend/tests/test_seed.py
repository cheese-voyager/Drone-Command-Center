import json

import pytest

from tests.mocks.fake_mavlink import global_position


def test_isi_benih(client, settings):
    r = client.post("/seed/load", json={"loaded": 200})
    assert r.status_code == 200
    assert r.json() == {"loaded": 200, "dropped": 0}
    assert json.loads(settings.config_path.read_text())["seed"] == {"loaded": 200, "dropped": 0}


def test_status_menampilkan_sisa_benih(client):
    client.post("/seed/load", json={"loaded": 50})
    assert client.get("/status").json()["seed"] == {"loaded": 50, "dropped": 0, "remaining": 50}


def test_isi_ulang_mereset_hitungan_terdrop(client, connected, fake_link, wait_until, container):
    client.post("/seed/load", json={"loaded": 5})
    client.post("/drop/config", json={"duration_s": 0.05})
    connected.handle_message(global_position(-6.9, 107.6, 10))
    assert client.post("/drop").status_code == 200
    assert client.get("/status").json()["seed"]["dropped"] == 1
    assert wait_until(lambda: not container.thruster.busy)

    r = client.post("/seed/load", json={"loaded": 100})

    assert r.json() == {"loaded": 100, "dropped": 0}
    assert client.get("/status").json()["seed"]["remaining"] == 100


@pytest.mark.parametrize("body", [{"loaded": -1}, {}, {"loaded": "banyak"}])
def test_benih_tidak_valid_ditolak(client, body):
    assert client.post("/seed/load", json=body).status_code == 422


def test_isi_nol_diperbolehkan(client):
    assert client.post("/seed/load", json={"loaded": 0}).json() == {"loaded": 0, "dropped": 0}
