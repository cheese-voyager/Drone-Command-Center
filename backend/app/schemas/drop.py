from pydantic import BaseModel, Field

from app.core.constants import MAX_DURATION_S


class DropConfigRequest(BaseModel):
    """Body `POST /drop/config`. Field yang tidak diisi tidak diubah."""

    thrust_percent: float | None = Field(None, ge=0, le=100)
    duration_s: float | None = Field(None, gt=0, le=MAX_DURATION_S)


class DropConfig(BaseModel):
    servo_channel: int
    thrust_percent: float
    duration_s: float
    seeds_per_drop: int
    pwm_min: int
    pwm_max: int


class DropRecord(BaseModel):
    """Satu titik drop (lat/lon bisa kosong kalau GPS belum ada)."""

    time: float
    lat: float | None = None
    lon: float | None = None
    thrust: float
    duration: float
