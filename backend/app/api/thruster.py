from fastapi import APIRouter

from app.api.deps import ThrusterDep
from app.schemas import ThrusterStopResponse, ThrusterTestRequest, ThrusterTestResponse

router = APIRouter(tags=["Thruster"])


@router.post("/thruster/test", response_model=ThrusterTestResponse)
def test_thruster(body: ThrusterTestRequest, thruster: ThrusterDep):
    """Tes thruster penebar benih atau motor/propeler 1-4 (pilih lewat `target`).

    Tidak mengurangi benih dan tidak dicatat sebagai drop."""
    return thruster.test(body.thrust_percent, body.duration_s, body.target)


@router.post("/thruster/stop", response_model=ThrusterStopResponse)
def stop_thruster(thruster: ThrusterDep):
    """STOP DARURAT thruster."""
    return ThrusterStopResponse(stopped=thruster.stop())
