from pydantic import BaseModel, Field


class BatteryConfig(BaseModel):
    """Body `POST /battery`. Dikirim setiap ganti baterai."""

    capacity_mah: int = Field(gt=0, description="Kapasitas baterai (mAh)")
    cells: int = Field(ge=1, le=14, description="Jumlah cell (S)")
    min_safe_percent: int = Field(25, ge=0, le=100, description="Batas sisa aman (%)")


class BatteryStatus(BaseModel):
    capacity_mah: int
    used_mah: float
    remaining_mah: float
    remaining_percent: float
    avg_current: float | None = None
    estimated_minutes_left: float | None = None
    low: bool
