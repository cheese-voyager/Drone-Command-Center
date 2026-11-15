from fastapi import APIRouter

from app.api import battery, drop, mqtt, seed, status, thruster, video, websocket

api_router = APIRouter()
for module in (status, websocket, mqtt, battery, seed, drop, thruster, video):
    api_router.include_router(module.router)
