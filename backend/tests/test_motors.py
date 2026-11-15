from pymavlink import mavutil

from tests.mocks.fake_mavlink import servo_output


def test_motor_kosong_sebelum_ada_data(client):
    assert client.get("/status").json()["motors"] is None


def test_empat_motor_dikonversi_ke_persen(client, connected):
    connected.handle_message(servo_output(1000, 1250, 1500, 2000))

    motors = client.get("/status").json()["motors"]
    assert [m["id"] for m in motors] == [1, 2, 3, 4]
    assert [m["pwm"] for m in motors] == [1000, 1250, 1500, 2000]
    assert [m["percent"] for m in motors] == [0.0, 25.0, 50.0, 100.0]


def test_pwm_di_luar_batas_dipotong_0_sampai_100(client, connected):
    connected.handle_message(servo_output(0, 900, 2100, 1500))

    percents = [m["percent"] for m in client.get("/status").json()["motors"]]
    assert percents == [0.0, 0.0, 100.0, 50.0]


def test_motor_ikut_terkirim_lewat_websocket(client, connected):
    connected.handle_message(servo_output(1100, 1100, 1100, 1100))
    with client.websocket_connect("/ws") as ws:
        assert len(ws.receive_json()["motors"]) == 4


def test_pesan_pymavlink_asli_servo_output_raw_bisa_diproses(client, connected):
    mav = mavutil.mavlink.MAVLink(None)
    msg = mav.servo_output_raw_encode(0, 0, 1100, 1200, 1300, 1400, 0, 0, 0, 0)
    connected.handle_message(msg)

    assert [m["pwm"] for m in client.get("/status").json()["motors"]] == [1100, 1200, 1300, 1400]


def test_thruster_penebar_tidak_tercampur_dengan_motor(client, connected, fake_link):
    connected.handle_message(servo_output(1500, 1500, 1500, 1500))
    r = client.post("/thruster/test", json={"thrust_percent": 50, "duration_s": 0.1})
    assert r.status_code == 200
    assert len(client.get("/status").json()["motors"]) == 4
    assert all(channel == 9 for channel, _ in fake_link.servo_commands)
