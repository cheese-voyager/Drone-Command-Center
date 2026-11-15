from fastapi import APIRouter

from app.api.deps import MqttDep
from app.schemas import MqttInfo

router = APIRouter(tags=["MQTT"])


@router.get("/mqtt", response_model=MqttInfo)
def mqtt_info(mqtt: MqttDep):
    """Status koneksi ke broker dan daftar topik, supaya dashboard tahu harus subscribe ke mana."""
    return mqtt.info()
