from fastapi import APIRouter

from app.api.deps import BatteryDep
from app.schemas import BatteryConfig

router = APIRouter(tags=["Baterai"])


@router.post("/battery", response_model=BatteryConfig)
def set_battery(body: BatteryConfig, battery: BatteryDep):
    """Isi ini setiap ganti baterai. Hitungan mAh terpakai otomatis di-reset."""
    return battery.configure(body)
