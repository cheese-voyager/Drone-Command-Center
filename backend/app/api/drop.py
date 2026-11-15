from fastapi import APIRouter

from app.api.deps import DropDep
from app.schemas import DropConfig, DropConfigRequest, DropRecord

router = APIRouter(tags=["Drop"])


@router.post("/drop/config", response_model=DropConfig)
def set_drop_config(body: DropConfigRequest, drops: DropDep):
    """Atur thrust (0-100) dan durasi (detik) untuk drop berikutnya."""
    return drops.update_config(body)


@router.post("/drop", response_model=DropRecord)
def drop_now(drops: DropDep):
    """Jalankan drop dengan pengaturan yang tersimpan."""
    return drops.drop()


@router.get("/drops", response_model=list[DropRecord])
def drop_history(drops: DropDep):
    """Daftar titik drop (lat, lon) untuk ditampilkan di peta."""
    return drops.history()
