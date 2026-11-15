from fastapi import APIRouter

from app.api.deps import DroneDep
from app.schemas import DroneStatus

router = APIRouter(tags=["Monitoring"])


@router.get("/status", response_model=DroneStatus)
def status(drone: DroneDep):
    """Semua data sekali ambil (posisi, IMU, baterai, benih, dll)."""
    return drone.get_status()


@router.get("/debug/mavlink")
def debug_mavlink(drone: DroneDep):
    """Diagnostik: pesan MAVLink apa saja yang sudah masuk, berapa banyak, dan seberapa baru.

    Kalau `GLOBAL_POSITION_INT` tidak ada di daftar, Pixhawk tidak mengirim posisi
    (cek stream/baud). Kalau ada tapi `lat`/`lon` di /status kosong, belum ada GPS fix."""
    return {
        "connection": drone.connection,
        "connected": drone.is_connected,
        "has_link": drone.has_link,
        "messages": drone.message_stats(),
    }
