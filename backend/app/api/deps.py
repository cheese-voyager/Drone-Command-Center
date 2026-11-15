"""Dependency FastAPI: mengambil service dari `app.state.container`."""
from typing import Annotated

from fastapi import Depends
from starlette.requests import HTTPConnection

from app.core.config import Settings
from app.services import ServiceContainer
from app.services.battery_service import BatteryService
from app.services.camera_service import CameraService
from app.services.drone_service import DroneService
from app.services.drop_service import DropService
from app.services.mqtt_service import MqttService
from app.services.seed_service import SeedService
from app.services.thruster_service import ThrusterService


def get_container(conn: HTTPConnection) -> ServiceContainer:
    return conn.app.state.container


ContainerDep = Annotated[ServiceContainer, Depends(get_container)]


def get_settings_dep(container: ContainerDep) -> Settings:
    return container.settings


def get_drone(container: ContainerDep) -> DroneService:
    return container.drone


def get_battery(container: ContainerDep) -> BatteryService:
    return container.battery


def get_seeds(container: ContainerDep) -> SeedService:
    return container.seeds


def get_drops(container: ContainerDep) -> DropService:
    return container.drops


def get_thruster(container: ContainerDep) -> ThrusterService:
    return container.thruster


def get_camera(container: ContainerDep) -> CameraService:
    return container.camera


def get_mqtt(container: ContainerDep) -> MqttService:
    return container.mqtt


SettingsDep = Annotated[Settings, Depends(get_settings_dep)]
DroneDep = Annotated[DroneService, Depends(get_drone)]
BatteryDep = Annotated[BatteryService, Depends(get_battery)]
SeedDep = Annotated[SeedService, Depends(get_seeds)]
DropDep = Annotated[DropService, Depends(get_drops)]
ThrusterDep = Annotated[ThrusterService, Depends(get_thruster)]
CameraDep = Annotated[CameraService, Depends(get_camera)]
MqttDep = Annotated[MqttService, Depends(get_mqtt)]
