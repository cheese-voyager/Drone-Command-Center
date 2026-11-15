from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.deps import CameraDep
from app.core.constants import MJPEG_MEDIA_TYPE

router = APIRouter(tags=["Kamera"])


@router.get("/video")
def video(camera: CameraDep):
    """Live preview kamera (MJPEG). Bisa dibuka langsung di browser atau tag <img>."""
    camera.open()  # gagal di sini -> 503, bukan stream kosong
    return StreamingResponse(camera.stream(), media_type=MJPEG_MEDIA_TYPE)
