from fastapi import APIRouter

from app.api.deps import SeedDep
from app.schemas import SeedConfig, SeedLoadRequest

router = APIRouter(tags=["Benih"])


@router.post("/seed/load", response_model=SeedConfig)
def load_seed(body: SeedLoadRequest, seeds: SeedDep):
    """Isi jumlah benih yang dimuat. Hitungan benih terdrop di-reset ke 0."""
    return seeds.load(body.loaded)
