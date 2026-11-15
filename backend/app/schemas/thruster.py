from typing import Literal

from pydantic import BaseModel, Field

from app.core.constants import DEFAULT_TEST_DURATION_S, DEFAULT_TEST_THRUST_PERCENT, MAX_DURATION_S

# seeder   = thruster penebar benih (servo drop, channel 9)
# motor_N  = motor/propeler penggerak nomor N (output 1-4 di Pixhawk)
# all_motors = keempat motor, satu per satu berurutan (1, 2, 3, 4)
TestTarget = Literal["seeder", "motor_1", "motor_2", "motor_3", "motor_4", "all_motors"]


class ThrusterTestRequest(BaseModel):
    target: TestTarget = Field(
        "seeder",
        description="Yang dites: thruster penebar benih, salah satu motor 1-4, atau semua motor "
        "berurutan. Tes motor hanya boleh saat disarm dan thrust maksimal 30%.",
    )
    thrust_percent: float = Field(DEFAULT_TEST_THRUST_PERCENT, ge=0, le=100)
    duration_s: float = Field(
        DEFAULT_TEST_DURATION_S,
        gt=0,
        le=MAX_DURATION_S,
        description="Lama tes (detik). Untuk all_motors, ini lama untuk SETIAP motor.",
    )


class ThrusterTestResponse(BaseModel):
    target: str = "seeder"
    thrust: float
    duration: float
    pwm: int | None = None  # hanya untuk seeder; tes motor memakai persen langsung
    total_duration: float | None = None  # total waktu tes (all_motors = durasi x 4)


class ThrusterStopResponse(BaseModel):
    stopped: bool
