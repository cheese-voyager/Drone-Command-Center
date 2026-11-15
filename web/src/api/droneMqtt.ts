import mqtt, { type MqttClient } from "mqtt";

// ---------- Tipe data (sama dengan GET /status dan GET /mqtt) ----------
export interface DroneStatus {
  connected: boolean;
  mode: string | null;
  armed: boolean;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  pitch: number | null;
  roll: number | null;
  yaw: number | null;
  speed: number | null;
  voltage: number | null;
  current: number | null;
  gps_fix: number | null;
  satellites: number | null;
  motors: { id: number; pwm: number; percent: number }[] | null;
  battery: {
    capacity_mah: number;
    used_mah: number;
    remaining_mah: number;
    remaining_percent: number;
    avg_current: number | null;
    estimated_minutes_left: number | null;
    low: boolean;
  };
  seed: { loaded: number; dropped: number; remaining: number };
  avg_speed: number | null;
}

export interface DropRecord {
  time: number;
  lat: number | null;
  lon: number | null;
  thrust: number;
  duration: number;
}

export interface MqttInfo {
  enabled: boolean;
  commands_enabled: boolean;
  connected: boolean;
  host: string;
  port: number;
  ws_port: number;
  base_topic: string;
  topics: {
    online: string;
    status: string;
    drop_event: string;
    response: string;
    commands: Record<string, string>;
  };
}

export interface CommandResponse<T = unknown> {
  cmd: string;
  ok: boolean;
  request_id?: string | number;
  data?: T;
  error?: { code: string; detail: string };
}

export type CommandName =
  | "drop"
  | "drop-config"
  | "seed-load"
  | "battery"
  | "thruster-test"
  | "thruster-stop";

// ---------- Klien ----------
export interface DroneClientOptions {
  /** Alamat backend, contoh: "http://192.168.4.1:8000" */
  apiUrl: string;
  username?: string;
  password?: string;
  /** Alamat broker kalau berbeda dari host backend (default: host dari apiUrl). */
  brokerHost?: string;
}

export interface DroneClient {
  info: MqttInfo;
  onStatus(cb: (status: DroneStatus) => void): void;
  onOnline(cb: (online: boolean) => void): void;
  onDrop(cb: (drop: DropRecord) => void): void;
  /** Kirim perintah dan tunggu jawabannya. Reject kalau backend menolak atau tidak menjawab. */
  send<T = unknown>(cmd: CommandName, body?: object, timeoutMs?: number): Promise<T>;
  close(): void;
}

export class CommandError extends Error {
  code: string;

  constructor(code: string, detail: string) {
    super(detail);
    this.code = code;
  }
}

export async function createDroneClient(opts: DroneClientOptions): Promise<DroneClient> {
  // 1. Tanya backend: topiknya apa, port WebSocket broker berapa
  const res = await fetch(`${opts.apiUrl}/mqtt`);
  if (!res.ok) throw new Error(`GET /mqtt gagal: ${res.status}`);
  const info: MqttInfo = await res.json();
  if (!info.enabled) throw new Error("MQTT dimatikan di backend (MQTT_ENABLED=false)");

  // 2. Browser hanya bisa MQTT lewat WebSocket, jadi pakai ws_port (bukan 1883)
  const isLocal = ["localhost", "127.0.0.1"].includes(info.host);
  const host = opts.brokerHost ?? (isLocal ? new URL(opts.apiUrl).hostname : info.host);
  const client: MqttClient = mqtt.connect(`ws://${host}:${info.ws_port}`, {
    username: opts.username,
    password: opts.password,
    reconnectPeriod: 2000,
  });

  const t = info.topics;
  const statusCbs: ((s: DroneStatus) => void)[] = [];
  const onlineCbs: ((o: boolean) => void)[] = [];
  const dropCbs: ((d: DropRecord) => void)[] = [];
  const pending = new Map<string, (r: CommandResponse) => void>();
  let counter = 0;

  // Langganan dibuat ulang setiap (re)connect
  client.on("connect", () => {
    client.subscribe([t.status, t.online, t.drop_event, t.response]);
  });

  client.on("message", (topic, payload) => {
    const text = payload.toString();
    if (topic === t.online) {
      onlineCbs.forEach((cb) => cb(text === "online"));
    } else if (topic === t.status) {
      const status: DroneStatus = JSON.parse(text);
      statusCbs.forEach((cb) => cb(status));
    } else if (topic === t.drop_event) {
      const drop: DropRecord = JSON.parse(text);
      dropCbs.forEach((cb) => cb(drop));
    } else if (topic === t.response) {
      const r: CommandResponse = JSON.parse(text);
      const done = pending.get(String(r.request_id));
      if (done) {
        pending.delete(String(r.request_id));
        done(r);
      }
    }
  });

  return {
    info,
    onStatus: (cb) => void statusCbs.push(cb),
    onOnline: (cb) => void onlineCbs.push(cb),
    onDrop: (cb) => void dropCbs.push(cb),
    send<T>(cmd: CommandName, body: object = {}, timeoutMs = 5000) {
      const id = `web-${Date.now()}-${++counter}`;
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Backend tidak menjawab perintah "${cmd}"`));
        }, timeoutMs);
        pending.set(id, (r) => {
          clearTimeout(timer);
          if (r.ok) resolve(r.data as T);
          else reject(new CommandError(r.error!.code, r.error!.detail));
        });
        client.publish(t.commands[cmd], JSON.stringify({ ...body, request_id: id }), { qos: 1 });
      });
    },
    close: () => void client.end(),
  };
}
