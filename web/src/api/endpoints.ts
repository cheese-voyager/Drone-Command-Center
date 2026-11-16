export const ENDPOINTS = {
  status: "/status",
  drops: "/drops",
  mqtt: "/mqtt",
  video: "/video",
  debugMavlink: "/debug/mavlink",
  battery: "/battery",
  seedLoad: "/seed/load",
  dropConfig: "/drop/config",
  drop: "/drop",
  thrusterTest: "/thruster/test",
  thrusterStop: "/thruster/stop",
  ws: "/ws",
} as const;

export const WS_PORT = 8000;
export const API_PORT = 8000;
export const MQTT_WS_DEFAULT_PORT = 9001;
