"""Lapisan logika. `build_container` merakit semua service jadi satu paket."""
from dataclasses import dataclass

from app.core.config import Settings
from app.services.battery_service import BatteryService
from app.services.camera_service import CameraService
from app.services.config_store import ConfigStore
from app.services.drone_service import DroneService
from app.services.drop_history import DropHistory
from app.services.drop_service import DropService
from app.services.mavlink_client import MavlinkFactory, create_link
from app.services.mqtt_service import MqttClientFactory, MqttService
from app.services.seed_service import SeedService
from app.services.thruster_service import ThrusterService


@dataclass
class ServiceContainer:
    settings: Settings
    config: ConfigStore
    battery: BatteryService
    seeds: SeedService
    history: DropHistory
    drone: DroneService
    thruster: ThrusterService
    drops: DropService
    camera: CameraService
    mqtt: MqttService

    def shutdown(self) -> None:
        """Dipanggil saat aplikasi mati: pastikan thruster berhenti, lalu tutup koneksi."""
        self.thruster.stop()
        self.mqtt.stop()
        self.drone.stop()
        self.camera.close()


def build_container(
    settings: Settings,
    link_factory: MavlinkFactory | None = None,
    camera: CameraService | None = None,
    mqtt_factory: MqttClientFactory | None = None,
) -> ServiceContainer:
    config = ConfigStore(settings.config_path)
    battery = BatteryService(config)
    seeds = SeedService(config)
    history = DropHistory(settings.drops_path)
    drone = DroneService(
        settings.mavlink_conn,
        link_factory or create_link,
        battery,
        seeds,
        stream_rate_hz=settings.mavlink_stream_rate_hz,
        recv_timeout_s=settings.mavlink_recv_timeout_s,
        reconnect_delay_s=settings.mavlink_reconnect_delay_s,
    )
    thruster = ThrusterService(config, drone)
    drops = DropService(config, seeds, thruster, drone, history)
    camera = camera or CameraService(
        settings.camera_width,
        settings.camera_height,
        settings.camera_fps,
        settings.camera_index,
    )
    mqtt = MqttService(settings, drone, battery, seeds, drops, thruster, mqtt_factory)
    drops.add_listener(mqtt.publish_drop)  # setiap drop (REST atau MQTT) jadi event MQTT
    return ServiceContainer(
        settings=settings,
        config=config,
        battery=battery,
        seeds=seeds,
        history=history,
        drone=drone,
        thruster=thruster,
        drops=drops,
        camera=camera,
        mqtt=mqtt,
    )


__all__ = ["ServiceContainer", "build_container"]
