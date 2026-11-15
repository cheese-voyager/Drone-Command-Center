from types import SimpleNamespace

from app.services import build_container
from app.services.mavlink_client import (
    MAV_CMD_SET_MESSAGE_INTERVAL,
    REQUIRED_MESSAGE_IDS,
    PymavlinkLink,
)
from tests.mocks.fake_mavlink import FakeMavlinkLink, global_position, heartbeat, vfr_hud


def _drone(make_settings):
    return build_container(make_settings(), link_factory=lambda conn: FakeMavlinkLink()).drone


def test_posisi_nol_nol_dianggap_belum_ada_gps(make_settings):
    drone = _drone(make_settings)
    drone.handle_message(global_position(0.0, 0.0, 1.5))
    status = drone.get_status()
    assert status.lat is None and status.lon is None
    assert status.alt == 1.5  # ketinggian tetap dipakai

    drone.handle_message(global_position(-6.9175, 107.6191, 2.0))
    assert drone.get_status().lat == -6.9175

    drone.handle_message(global_position(0.0, 0.0, 2.0))  # GPS hilang lagi
    assert drone.get_status().lat is None


def test_message_stats_menghitung_per_jenis(make_settings):
    drone = _drone(make_settings)
    drone.handle_message(heartbeat())
    drone.handle_message(vfr_hud(3.0))
    drone.handle_message(vfr_hud(4.0))
    stats = {s["type"]: s for s in drone.message_stats()}
    assert stats["HEARTBEAT"]["count"] == 1
    assert stats["VFR_HUD"]["count"] == 2
    assert stats["VFR_HUD"]["age_s"] >= 0
    assert "GLOBAL_POSITION_INT" not in stats  # tidak pernah dikirim Pixhawk


def test_endpoint_debug_mavlink(make_settings):
    from fastapi.testclient import TestClient

    from app.main import create_app

    with TestClient(create_app(make_settings())) as client:
        client.app.state.container.drone.handle_message(heartbeat())
        body = client.get("/debug/mavlink").json()
    assert body["messages"][0]["type"] == "HEARTBEAT"
    assert {"connection", "connected", "has_link"} <= body.keys()


def test_request_streams_juga_minta_interval_per_pesan():
    sent = []
    mav = SimpleNamespace(
        request_data_stream_send=lambda *a: sent.append(("stream", a)),
        command_long_send=lambda *a: sent.append(("cmd", a)),
    )
    link = PymavlinkLink("udpin:127.0.0.1:14551")
    link._master = SimpleNamespace(target_system=1, target_component=1, mav=mav)

    link.request_streams(5)

    cmds = [a for kind, a in sent if kind == "cmd"]
    assert [kind for kind, _ in sent].count("stream") == 1
    assert {a[2] for a in cmds} == {MAV_CMD_SET_MESSAGE_INTERVAL}
    assert [a[4] for a in cmds] == list(REQUIRED_MESSAGE_IDS)  # param1 = id pesan
    assert all(a[5] == 200_000 for a in cmds)  # 5 Hz = 200000 us
