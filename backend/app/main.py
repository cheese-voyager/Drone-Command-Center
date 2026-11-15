"""Server API. Jalankan dari folder backend/ dengan:

    uvicorn app.main:app --host 0.0.0.0 --port 8000

Lalu buka http://<IP-RASPI>:8000/docs untuk mencoba semua fitur.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.exceptions import AppError
from app.core.logger import get_logger, setup_logging
from app.services import build_container
from app.services.camera_service import CameraService
from app.services.mavlink_client import MavlinkFactory
from app.services.mqtt_service import MqttClientFactory

log = get_logger("main")


def create_app(
    settings: Settings | None = None,
    link_factory: MavlinkFactory | None = None,
    camera: CameraService | None = None,
    mqtt_factory: MqttClientFactory | None = None,
) -> FastAPI:
    """`link_factory`, `camera`, dan `mqtt_factory` bisa diganti dengan tiruan saat tes."""
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        setup_logging(settings.log_level, settings.log_dir)
        container = build_container(
            settings, link_factory=link_factory, camera=camera, mqtt_factory=mqtt_factory
        )
        app.state.container = container
        if settings.mavlink_enabled:
            container.drone.start()
        else:
            log.warning("MAVLINK_ENABLED=false: Pixhawk tidak dihubungi")
        container.mqtt.start()  # tidak melakukan apa-apa kalau MQTT_ENABLED=false
        try:
            yield
        finally:
            container.shutdown()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Backend drone penebar benih (Pixhawk + Raspberry Pi).",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message, "code": exc.code},
        )

    app.include_router(api_router)
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    _s = get_settings()
    uvicorn.run("app.main:app", host=_s.host, port=_s.port)
