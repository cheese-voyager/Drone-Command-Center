from pydantic import BaseModel, Field


class SeedLoadRequest(BaseModel):
    loaded: int = Field(ge=0, description="Jumlah benih yang dimuat")


class SeedConfig(BaseModel):
    """Response `POST /seed/load`."""

    loaded: int
    dropped: int


class SeedStatus(BaseModel):
    loaded: int
    dropped: int
    remaining: int
