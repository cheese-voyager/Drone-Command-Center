import math

import pytest
from fastapi.testclient import TestClient
from pymavlink import mavutil

from app.main import create_app
from app.services.mavlink_client import MAV_CMD_DO_SET_SERVO
from tests.mocks.fake_mavlink import (
    FakeMavlinkLink,
    attitude,
    battery_status,
    command_ack,
    ekf_status,
    gcs_heartbeat,
    global_position,
    gps_raw,
    heartbeat,
    mission_count,
    mission_current,
    mission_item_int,
    nav_controller_output,
    power_status,
    radio_status,
    servo_output,
    status_text,
    sys_status,
    vfr_hud,
    vibration,
    wind_cov,
)

STATUS_KEYS = {
    "schema_version", "connected", "mode", "armed", "lat", "lon", "alt", "pitch", "roll", "yaw",
    "speed", "voltage", "current", "gps_fix", "satellites", "motors", "battery", "seed",
    "gps", "nav", "mission", "servo", "avg_speed", "time", "power", "health", "link", "messages",
}  # fmt: skip


def test_status_awal_sebelum_ada_data(client):
    r = client.get("/status")
    assert r.status_code == 200
    body = r.json()

    assert set(body) == STATUS_KEYS
    assert body["connected"] is False
    assert body["armed"] is False
    assert body["lat"] is None and body["voltage"] is None and body["avg_speed"] is None
    assert body["battery"] == {
        "capacity_mah": 10000,
        "used_mah": 0.0,
        "remaining_mah": 10000.0,
        "remaining_percent": 100.0,
        "avg_current": None,
        "estimated_minutes_left": None,
        "low": False,
    }
    assert body["seed"] == {"loaded": 0, "dropped": 0, "remaining": 0}


def test_semua_pesan_dikonversi_ke_satuan_dashboard(client, drone, fake_link):
    drone.attach_link(fake_link)
    drone.handle_message(heartbeat(armed=True))
    drone.handle_message(global_position(-6.9175, 107.6191, 12.5))
    drone.handle_message(attitude(math.radians(5), math.radians(-3), math.radians(-90)))
    drone.handle_message(vfr_hud(4.2))
    drone.handle_message(gps_raw(fix_type=3, satellites=11))
    drone.handle_message(sys_status(voltage_v=22.4, current_a=8.5))

    body = client.get("/status").json()
    assert body["connected"] is True
    assert body["mode"] == "GUIDED"
    assert body["armed"] is True
    assert body["lat"] == pytest.approx(-6.9175)
    assert body["lon"] == pytest.approx(107.6191)
    assert body["alt"] == pytest.approx(12.5)  # mm -> meter
    assert body["pitch"] == pytest.approx(5)  # radian -> derajat
    assert body["roll"] == pytest.approx(-3)
    assert body["yaw"] == pytest.approx(270)  # -90 deg -> 0-360
    assert body["speed"] == pytest.approx(4.2)
    assert body["gps_fix"] == 3
    assert body["satellites"] == 11
    assert body["voltage"] == pytest.approx(22.4)  # mV -> Volt
    assert body["current"] == pytest.approx(8.5)  # cA -> Ampere


def test_diagnostics_p0_masuk_status(client, drone):
    drone.handle_message(global_position(-6.9, 107.6, 8.0))
    drone.handle_message(
        sys_status(
            voltage_v=22.0,
            current_a=10.0,
            battery_remaining=77,
            load=450,
            sensors_health=123,
            drop_rate_comm=2,
            errors_comm=1,
        )
    )
    drone.handle_message(battery_status(remaining=75, energy_mwh=4200, cells=(4200, 4190)))
    drone.handle_message(power_status(usb=True, brick_valid=False))
    drone.handle_message(radio_status())
    drone.handle_message(ekf_status(flags=0x1F))
    drone.handle_message(vibration(clipping=2))
    drone.handle_message(status_text("PreArm: GPS glitch"))
    drone.handle_message(status_text("Battery failsafe"))

    body = client.get("/status").json()

    assert body["schema_version"] == 1
    assert body["time"]["boot_ms"] == 0
    assert body["power"]["remaining_percent"] == 75
    assert body["power"]["energy_consumed_wh"] == pytest.approx(4.2)
    assert body["power"]["cell_voltages_v"] == pytest.approx([4.2, 4.19])
    assert body["power"]["load_percent"] == pytest.approx(45.0)
    assert body["power"]["usb_connected"] is True
    assert body["power"]["power_brick_out"] is True
    assert body["health"]["ekf_ok"] is True
    assert body["health"]["sensor_health"] == 123
    assert body["health"]["comm_errors"] == 1
    assert body["health"]["clipping_events"] == 3
    assert body["link"]["rssi"] == 60
    assert body["link"]["fixed"] == 120
    assert len(body["messages"]) == 2
    assert set(body["health"]["failsafe"]) == {"PreArm: GPS glitch", "Battery failsafe"}


def test_navigasi_dan_misi_p1_masuk_status(client, drone, fake_link):
    drone.attach_link(fake_link)
    drone.handle_message(heartbeat(armed=True))
    drone.handle_message(global_position(-6.9, 107.6, 12.5, alt_m=18.0))
    drone.handle_message(attitude(math.radians(5), 0, math.radians(-90)))
    drone.handle_message(vfr_hud(4.2))
    drone.handle_message(gps_raw(fix_type=6, satellites=14, eph=55, epv=80, vel=350, cog=8300))
    drone.handle_message(wind_cov())
    drone.handle_message(mission_current(2))
    drone.handle_message(mission_count(6))
    drone.handle_message(mission_item_int(seq=3, lat=-6.918, lon=107.62))
    drone.handle_message(nav_controller_output())
    drone.handle_message(servo_output(1500, 1510, 1520, 1530))

    body = client.get("/status").json()
    assert body["gps"]["fix_type"] == 6
    assert body["gps"]["satellites_visible"] == 14
    assert body["gps"]["hdop"] == pytest.approx(0.55)
    assert body["gps"]["vdop"] == pytest.approx(0.8)
    assert body["gps"]["alt_msl_m"] == pytest.approx(15.0)
    assert body["gps"]["speed_mps"] == pytest.approx(3.5)
    assert body["gps"]["cog_deg"] == pytest.approx(83.0)
    assert body["gps"]["rtk_status"] == "fixed"

    assert body["nav"]["alt_rel_m"] == pytest.approx(12.5)
    assert body["nav"]["alt_amsl_m"] == pytest.approx(18.0)
    assert body["nav"]["airspeed_mps"] == pytest.approx(4.0)
    assert body["nav"]["groundspeed_mps"] == pytest.approx(4.2)
    assert body["nav"]["climb_mps"] == pytest.approx(0.6)
    assert body["nav"]["throttle_percent"] == 42
    assert body["nav"]["heading_deg"] == 83
    assert body["nav"]["vx_mps"] == pytest.approx(3.2)
    assert body["nav"]["wind_speed_mps"] == pytest.approx(2.5)
    assert body["nav"]["wind_direction_deg"] == pytest.approx(143.1, abs=0.2)
    assert body["nav"]["wind_source"] == "WIND_COV"

    assert body["mission"]["current_wp"] == 2
    assert body["mission"]["total_wp"] == 6
    assert body["mission"]["next_wp_lat"] == pytest.approx(-6.918)
    assert body["mission"]["next_wp_lon"] == pytest.approx(107.62)
    assert body["mission"]["wp_distance_m"] == 45
    assert body["mission"]["target_bearing_deg"] == 83
    assert body["mission"]["xtrack_error_m"] == pytest.approx(0.4)
    assert body["mission"]["state"] == "GUIDED"

    channels = {item["channel"]: item for item in body["servo"]["channels"]}
    assert channels[9]["pwm"] == 1800
    assert channels[4]["pwm"] == 1530

    drone.set_servo(9, 1900)
    drone.handle_message(command_ack(MAV_CMD_DO_SET_SERVO, result=0))
    last_drop = client.get("/status").json()["servo"]["last_drop"]
    assert last_drop["channel"] == 9
    assert last_drop["pwm"] == 1900
    assert last_drop["ack_result"] == "ACCEPTED"


def test_disarm_terbaca_dari_heartbeat(client, drone, fake_link):
    drone.attach_link(fake_link)
    drone.handle_message(heartbeat(armed=True))
    assert client.get("/status").json()["armed"] is True
    drone.handle_message(heartbeat(armed=False))
    assert client.get("/status").json()["armed"] is False


def test_heartbeat_gcs_diabaikan(client, drone, fake_link):
    """Heartbeat Mission Planner (lewat MAVProxy) tidak boleh menimpa status drone."""
    drone.attach_link(fake_link)
    drone.handle_message(heartbeat(armed=True))
    drone.handle_message(gcs_heartbeat())
    assert client.get("/status").json()["armed"] is True


def test_voltase_dan_arus_tidak_diketahui_tetap_kosong(client, drone):
    drone.handle_message(sys_status(voltage_v=None, current_a=None))
    body = client.get("/status").json()
    assert body["voltage"] is None
    assert body["current"] is None
    assert body["battery"]["avg_current"] is None


def test_arus_dari_sys_status_masuk_hitungan_baterai(client, drone, container, clock, monkeypatch):
    monkeypatch.setattr(container.battery, "_clock", clock)
    drone.handle_message(sys_status(voltage_v=22.0, current_a=10.0))
    clock.advance(36)
    drone.handle_message(sys_status(voltage_v=22.0, current_a=10.0))

    battery = client.get("/status").json()["battery"]
    assert battery["used_mah"] == pytest.approx(100.0)
    assert battery["avg_current"] == pytest.approx(10.0)
    assert battery["estimated_minutes_left"] == pytest.approx(59.4)


def test_rata_rata_kecepatan(client, drone):
    for speed in (2.0, 4.0, 6.0):
        drone.handle_message(vfr_hud(speed))
    body = client.get("/status").json()
    assert body["speed"] == 6.0
    assert body["avg_speed"] == pytest.approx(4.0)


def test_pesan_tak_dikenal_diabaikan_tapi_berarti_terhubung(client, drone):
    from types import SimpleNamespace

    drone.handle_message(SimpleNamespace(get_type=lambda: "STATUSTEXT"))
    assert client.get("/status").json()["connected"] is True


def test_nama_field_sesuai_pymavlink_asli():
    """Jaga-jaga salah ketik: field yang dibaca drone_service harus ada di pesan pymavlink asli."""
    m = mavutil.mavlink
    expected = {
        "MAVLink_heartbeat_message": {"type", "autopilot", "base_mode"},
        "MAVLink_global_position_int_message": {"lat", "lon", "relative_alt"},
        "MAVLink_attitude_message": {"pitch", "roll", "yaw"},
        "MAVLink_vfr_hud_message": {"groundspeed"},
        "MAVLink_gps_raw_int_message": {"fix_type", "satellites_visible", "eph", "epv"},
        "MAVLink_sys_status_message": {"voltage_battery", "current_battery"},
        "MAVLink_wind_cov_message": {"wind_x", "wind_y"},
        "MAVLink_mission_current_message": {"seq"},
        "MAVLink_mission_count_message": {"count"},
        "MAVLink_mission_item_int_message": {"x", "y"},
        "MAVLink_nav_controller_output_message": {"wp_dist", "target_bearing", "xtrack_error"},
        "MAVLink_servo_output_raw_message": {"servo1_raw", "servo5_raw", "servo8_raw"},
    }
    for cls_name, fields in expected.items():
        assert fields <= set(getattr(m, cls_name).fieldnames), cls_name


def test_pesan_pymavlink_asli_bisa_diproses(client, drone, fake_link):
    m = mavutil.mavlink
    drone.attach_link(fake_link)
    drone.handle_message(
        m.MAVLink_sys_status_message(0, 0, 0, 0, 22400, 850, -1, 0, 0, 0, 0, 0, 0)
    )
    drone.handle_message(
        m.MAVLink_global_position_int_message(0, -69175000, 1076191000, 0, 12500, 0, 0, 0, 0)
    )
    body = client.get("/status").json()
    assert body["voltage"] == pytest.approx(22.4)
    assert body["current"] == pytest.approx(8.5)
    assert body["lat"] == pytest.approx(-6.9175)
    assert body["alt"] == pytest.approx(12.5)


# ---------- WebSocket ----------
def test_websocket_mengirim_status_berulang(client, drone, fake_link):
    drone.attach_link(fake_link)
    drone.handle_message(global_position(-6.9, 107.6, 3.0))

    with client.websocket_connect("/ws") as ws:
        first = ws.receive_json()
        second = ws.receive_json()

    assert set(first) == STATUS_KEYS
    assert first["lat"] == pytest.approx(-6.9)
    assert second["alt"] == pytest.approx(3.0)


def test_websocket_isi_sama_dengan_http_status(client, drone):
    drone.handle_message(vfr_hud(3.0))
    with client.websocket_connect("/ws") as ws:
        via_ws = ws.receive_json()
    assert via_ws == client.get("/status").json()


def test_websocket_banyak_klien(client):
    with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
        assert a.receive_json()["connected"] is False
        assert b.receive_json()["connected"] is False


# ---------- Thread pembaca MAVLink ----------
@pytest.fixture
def live_client(make_settings):
    """App dengan thread pembaca MAVLink menyala, memakai Pixhawk tiruan."""
    link = FakeMavlinkLink()
    app = create_app(make_settings(mavlink_enabled=True), link_factory=lambda conn: link)
    with TestClient(app) as c:
        yield c, link


def test_thread_pembaca_memperbarui_status(live_client, wait_until):
    client, link = live_client
    link.push(heartbeat(armed=True), global_position(-6.9, 107.6, 8.0), sys_status(22.0, 5.0))

    assert wait_until(lambda: client.get("/status").json()["lat"] is not None)
    body = client.get("/status").json()
    assert body["lat"] == pytest.approx(-6.9)
    assert body["armed"] is True
    assert body["voltage"] == pytest.approx(22.0)
    assert link.stream_requests == [5]  # minta data 5x per detik


def test_connected_false_kalau_data_berhenti(live_client, wait_until):
    client, link = live_client
    link.push(heartbeat())
    assert wait_until(lambda: client.get("/status").json()["lat"] is None)  # tidak ada posisi
    # setelah antrean habis, recv() timeout -> dianggap terputus
    assert wait_until(lambda: client.get("/status").json()["connected"] is False)


def test_menyambung_ulang_setelah_error(make_settings, wait_until):
    link = FakeMavlinkLink()
    link.connect_error = OSError("port belum siap")
    app = create_app(make_settings(mavlink_enabled=True), link_factory=lambda conn: link)

    with TestClient(app) as client:
        link.push(global_position(-6.9, 107.6, 1.0))
        assert wait_until(lambda: client.get("/status").json()["lat"] is not None)
        assert link.connect_calls >= 2  # percobaan pertama gagal, kedua berhasil
