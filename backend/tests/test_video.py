import pytest
from fastapi.testclient import TestClient

from app.core.exceptions import CameraUnavailableError
from app.main import create_app


class StubCamera:
    def __init__(self, error: Exception | None = None):
        self.error = error
        self.closed = False

    def open(self):
        if self.error:
            raise self.error

    def stream(self):
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\nFRAME1\r\n"
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\nFRAME2\r\n"

    def close(self):
        self.closed = True


def test_video_mengalirkan_mjpeg(settings, fake_link):
    app = create_app(settings, link_factory=lambda c: fake_link, camera=StubCamera())
    with TestClient(app) as client:
        r = client.get("/video")
    assert r.status_code == 200
    assert r.headers["content-type"] == "multipart/x-mixed-replace; boundary=frame"
    assert b"FRAME1" in r.content and b"FRAME2" in r.content


def test_video_503_kalau_kamera_tidak_ada(settings, fake_link):
    camera = StubCamera(CameraUnavailableError("Kamera tidak ditemukan"))
    app = create_app(settings, link_factory=lambda c: fake_link, camera=camera)
    with TestClient(app) as client:
        r = client.get("/video")
    assert r.status_code == 503
    assert r.json() == {"detail": "Kamera tidak ditemukan", "code": "camera_unavailable"}


def test_kamera_ditutup_saat_aplikasi_mati(settings, fake_link):
    camera = StubCamera()
    app = create_app(settings, link_factory=lambda c: fake_link, camera=camera)
    with TestClient(app):
        pass
    assert camera.closed is True


def test_kamera_asli_tanpa_perangkat_memberi_error_jelas(make_settings):
    """Di mesin tanpa kamera (misalnya CI), harus gagal dengan rapi, bukan menggantung."""
    from app.services.camera_service import CameraService

    cam = CameraService(camera_index=99)
    with pytest.raises(CameraUnavailableError):
        cam.open()


def test_shutdown_mengembalikan_servo_ke_minimum(settings, fake_link):
    app = create_app(settings, link_factory=lambda c: fake_link, camera=StubCamera())
    with TestClient(app) as client:
        container = client.app.state.container
        container.drone.attach_link(fake_link)
    assert fake_link.servo_commands[-1] == (9, 1000)
