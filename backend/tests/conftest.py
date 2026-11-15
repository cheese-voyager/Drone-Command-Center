import time

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.mocks.fake_mavlink import FakeMavlinkLink, heartbeat


class FakeClock:
    def __init__(self, start: float = 1000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def make_settings(tmp_path):
    """Settings yang menyimpan data di folder sementara dan tanpa membaca file .env."""

    def _make(**overrides) -> Settings:
        values = {
            "data_dir": tmp_path / "data",
            "log_dir": tmp_path / "logs",
            "mavlink_enabled": False,
            "mqtt_enabled": False,
            "ws_interval_s": 0.01,
            "log_level": "WARNING",
            "mavlink_recv_timeout_s": 0.05,
            "mavlink_reconnect_delay_s": 0.05,
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)

    return _make


@pytest.fixture
def settings(make_settings):
    return make_settings()


@pytest.fixture
def fake_link():
    return FakeMavlinkLink()


@pytest.fixture
def client(settings, fake_link):
    app = create_app(settings, link_factory=lambda conn: fake_link)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def container(client):
    return client.app.state.container


@pytest.fixture
def drone(container):
    return container.drone


@pytest.fixture
def connected(drone, fake_link):
    """Drone yang sudah terhubung ke Pixhawk tiruan."""
    drone.attach_link(fake_link)
    drone.handle_message(heartbeat())
    return drone


@pytest.fixture
def wait_until():
    def _wait(predicate, timeout: float = 3.0, interval: float = 0.01) -> bool:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if predicate():
                return True
            time.sleep(interval)
        return predicate()

    return _wait


@pytest.fixture
def container_of():
    """Ambil ServiceContainer dari TestClient mana pun (dipakai tes yang membuat app sendiri)."""
    return lambda client: client.app.state.container
