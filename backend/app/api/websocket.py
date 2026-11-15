import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.api.deps import DroneDep, SettingsDep

router = APIRouter(tags=["Monitoring"])


@router.websocket("/ws")
async def ws_status(websocket: WebSocket, drone: DroneDep, settings: SettingsDep):
    """Data real-time (isi sama dengan `GET /status`), default 5x per detik."""
    await websocket.accept()
    try:
        while True:
            await websocket.send_json(drone.get_status().model_dump(mode="json"))
            await asyncio.sleep(settings.ws_interval_s)
    except (WebSocketDisconnect, RuntimeError):
        pass  # klien menutup koneksi
