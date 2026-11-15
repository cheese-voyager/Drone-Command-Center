from pydantic import BaseModel

from app.schemas.battery import BatteryStatus
from app.schemas.seed import SeedStatus


class MotorStatus(BaseModel):
    """Satu motor/propeler penggerak drone (bukan thruster penebar benih)."""

    id: int  # 1-4
    pwm: int  # output PWM dari Pixhawk (1000-2000)
    percent: float  # 0-100, dihitung dari PWM


class DroneStatus(BaseModel):
    """Isi `GET /status` dan setiap pesan `WS /ws`."""

    connected: bool
    mode: str | None = None
    armed: bool
    lat: float | None = None
    lon: float | None = None
    alt: float | None = None
    pitch: float | None = None
    roll: float | None = None
    yaw: float | None = None
    speed: float | None = None
    voltage: float | None = None
    current: float | None = None
    gps_fix: int | None = None
    satellites: int | None = None
    motors: list[MotorStatus] | None = None  # 4 motor, None kalau belum ada data
    battery: BatteryStatus
    seed: SeedStatus
    avg_speed: float | None = None
