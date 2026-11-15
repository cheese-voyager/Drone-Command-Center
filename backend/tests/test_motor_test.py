import time

import pytest

from tests.mocks.fake_mavlink import heartbeat


def _wait_free(container, wait_until):
    assert wait_until(lambda: not container.thruster.busy)


@pytest.mark.parametrize("n", [1, 2, 3, 4])
def test_tes_satu_motor(client, connected, fake_link, container, wait_until, n):
    r = client.post(
        "/thruster/test", json={"target": f"motor_{n}", "thrust_percent": 10, "duration_s": 0.05}
    )
    assert r.status_code == 200
    assert r.json() == {
        "target": f"motor_{n}",
        "thrust": 10,
        "duration": 0.05,
        "pwm": None,
        "total_duration": 0.05,
    }
    assert fake_link.motor_commands == [(n, 10, 0.05, 1)]
    assert fake_link.servo_commands == []  # servo penebar benih tidak tersentuh
    _wait_free(container, wait_until)


def test_tes_semua_motor_berurutan(client, connected, fake_link, container, wait_until):
    r = client.post(
        "/thruster/test", json={"target": "all_motors", "thrust_percent": 15, "duration_s": 0.02}
    )
    assert r.status_code == 200
    assert r.json()["total_duration"] == pytest.approx(0.08)
    assert fake_link.motor_commands == [(1, 15, 0.02, 4)]
    _wait_free(container, wait_until)


def test_tanpa_target_tetap_thruster_penebar(client, connected, fake_link, container, wait_until):
    client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 0.05})
    assert fake_link.motor_commands == []
    assert fake_link.servo_commands[0] == (9, 1200)
    _wait_free(container, wait_until)


def test_target_tidak_dikenal_ditolak(client, connected, fake_link):
    r = client.post("/thruster/test", json={"target": "motor_5"})
    assert r.status_code == 422
    assert fake_link.motor_commands == []


def test_thrust_motor_dibatasi_30_persen(client, connected, fake_link):
    r = client.post("/thruster/test", json={"target": "motor_1", "thrust_percent": 31})
    assert r.status_code == 400
    assert r.json()["code"] == "invalid_parameter"
    assert fake_link.motor_commands == []
    # thruster penebar benih masih boleh sampai 100%
    client.post("/thruster/stop")


def test_tes_motor_ditolak_kalau_drone_armed(client, connected, fake_link, container):
    connected.handle_message(heartbeat(armed=True))
    r = client.post("/thruster/test", json={"target": "motor_2", "thrust_percent": 10})
    assert r.status_code == 400
    assert r.json()["code"] == "drone_armed"
    assert fake_link.motor_commands == []
    assert not container.thruster.busy  # hak pakai dilepas lagi


def test_tes_motor_ditolak_kalau_belum_terhubung(client, fake_link):
    r = client.post("/thruster/test", json={"target": "motor_1", "thrust_percent": 10})
    assert r.status_code == 400
    assert r.json()["code"] == "drone_not_connected"
    assert fake_link.motor_commands == []


def test_tes_motor_ditolak_saat_thruster_berjalan(client, connected, container, wait_until):
    client.post("/thruster/test", json={"thrust_percent": 20, "duration_s": 0.5})
    r = client.post("/thruster/test", json={"target": "motor_1", "thrust_percent": 10})
    assert r.status_code == 400
    assert r.json()["code"] == "busy"
    _wait_free(container, wait_until)


def test_perintah_gagal_terkirim_melepas_hak_pakai(client, connected, fake_link, container):
    fake_link.fail_servo = True
    r = client.post("/thruster/test", json={"target": "motor_1", "thrust_percent": 10})
    assert r.status_code == 502
    assert not container.thruster.busy


def test_stop_darurat_menghentikan_tes_motor(client, connected, fake_link, container, wait_until):
    client.post("/thruster/test", json={"target": "motor_3", "thrust_percent": 20, "duration_s": 5})
    assert container.thruster.busy

    started = time.monotonic()
    r = client.post("/thruster/stop")

    assert r.json() == {"stopped": True}
    assert wait_until(lambda: not container.thruster.busy, timeout=1.0)
    assert time.monotonic() - started < 1.0
    assert fake_link.motor_commands[-1] == (1, 0.0, 0.0, 1)  # perintah berhenti ke Pixhawk


def test_stop_tanpa_tes_motor_tidak_mengirim_perintah_motor(client, connected, fake_link):
    client.post("/thruster/stop")
    assert fake_link.motor_commands == []


def test_perintah_pymavlink_asli_benar():
    from pymavlink import mavutil

    from app.services.mavlink_client import PymavlinkLink

    class _Mav:
        sent = None

        def command_long_send(self, *args):
            _Mav.sent = args

    class _Master:
        target_system, target_component, mav = 1, 1, _Mav()

    link = PymavlinkLink("udpin:127.0.0.1:0")
    link._master = _Master()
    link.motor_test(3, 12.5, 2.0, 1)

    assert _Mav.sent == (
        1, 1, mavutil.mavlink.MAV_CMD_DO_MOTOR_TEST, 0,
        3, mavutil.mavlink.MOTOR_TEST_THROTTLE_PERCENT, 12.5, 2.0, 1,
        mavutil.mavlink.MOTOR_TEST_ORDER_BOARD, 0,
    )  # fmt: skip
