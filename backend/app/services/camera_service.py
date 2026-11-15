"""Live preview kamera (MJPEG).

Otomatis pakai kamera Raspi (picamera2); kalau tidak ada, pakai webcam lewat OpenCV."""
import io
import threading
import time
from collections.abc import Iterator

from app.core.constants import MJPEG_BOUNDARY
from app.core.exceptions import CameraUnavailableError
from app.core.logger import get_logger

log = get_logger("camera")


class CameraService:
    def __init__(
        self,
        width: int = 640,
        height: int = 480,
        fps: float = 10.0,
        camera_index: int = 0,
    ):
        self._width = width
        self._height = height
        self._fps = fps
        self._index = camera_index
        self._lock = threading.Lock()
        self._backend: str | None = None  # "picamera" atau "opencv"
        self._cam = None

    def open(self) -> None:
        """Buka kamera kalau belum. Raise CameraUnavailableError kalau tidak ada kamera."""
        with self._lock:
            if self._backend is not None:
                return

            try:
                from picamera2 import Picamera2

                cam = Picamera2()
                cam.configure(
                    cam.create_video_configuration(main={"size": (self._width, self._height)})
                )
                cam.start()
                self._backend, self._cam = "picamera", cam
                log.info("Kamera Raspi (picamera2) terbuka")
                return
            except Exception as exc:
                log.info("picamera2 tidak bisa dipakai (%s), mencoba webcam OpenCV", exc)

            try:
                import cv2
            except ImportError as exc:
                raise CameraUnavailableError("OpenCV tidak terpasang") from exc

            cap = cv2.VideoCapture(self._index)
            if not cap.isOpened():
                cap.release()
                raise CameraUnavailableError(
                    "Kamera tidak ditemukan atau sedang dipakai program lain"
                )
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, self._width)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self._height)
            self._backend, self._cam = "opencv", cap
            log.info("Webcam OpenCV terbuka (index %s)", self._index)

    def read_frame(self) -> bytes | None:
        """Ambil satu gambar JPEG, atau None kalau gagal membaca."""
        with self._lock:  # kamera hanya boleh dipakai satu thread sekali waktu
            if self._backend == "picamera":
                buf = io.BytesIO()
                self._cam.capture_file(buf, format="jpeg")
                return buf.getvalue()
            if self._backend == "opencv":
                import cv2

                ok, frame = self._cam.read()
                if not ok:
                    return None
                ok, encoded = cv2.imencode(".jpg", frame)
                return encoded.tobytes() if ok else None
        raise CameraUnavailableError()

    def stream(self) -> Iterator[bytes]:
        """Generator yang mengirim gambar terus-menerus (~fps per detik)."""
        self.open()
        interval = 1.0 / self._fps
        while True:
            frame = self.read_frame()
            if frame:
                yield (
                    f"--{MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\n\r\n".encode()
                    + frame
                    + b"\r\n"
                )
            time.sleep(interval)

    def close(self) -> None:
        with self._lock:
            if self._backend == "picamera":
                try:
                    self._cam.stop()
                    self._cam.close()
                except Exception:
                    pass
            elif self._backend == "opencv":
                self._cam.release()
            self._backend, self._cam = None, None
