import { create } from "zustand";
import type { DroneClient } from "../api/droneMqtt";
import type { CommandName, DropRecord, DroneStatus, TelemetrySample } from "../types";

const MAX_HISTORY = 1800;

function sampleFromStatus(status: DroneStatus): TelemetrySample {
  return {
    time: Date.now(),
    lat: status.lat,
    lon: status.lon,
    alt: status.alt,
    speed: status.speed,
    yaw: status.yaw,
    voltage: status.voltage,
    current: status.current,
    battery: status.battery?.remaining_percent ?? null,
    satellites: status.satellites,
    gps_fix: status.gps_fix,
    mode: status.mode,
    armed: status.armed,
    motors: status.motors,
    seed_remaining: status.seed?.remaining ?? null,
  };
}

interface DroneStoreState {
  client: DroneClient | null;
  status: DroneStatus | null;
  history: TelemetrySample[];
  drops: DropRecord[];
  backendOnline: boolean;
  stale: boolean;
  lastDrop: DropRecord | null;
  error: string | null;
  connecting: boolean;
  lastStatusAt: number;
  setClient: (client: DroneClient | null) => void;
  setConnecting: (connecting: boolean) => void;
  setBackendOnline: (online: boolean) => void;
  setStatus: (status: DroneStatus) => void;
  setLastDrop: (drop: DropRecord) => void;
  pushDrop: (drop: DropRecord) => void;
  resetDrops: () => void;
  setError: (error: string | null) => void;
  setStale: (stale: boolean) => void;
  send: <T>(cmd: CommandName, body?: object, timeoutMs?: number) => Promise<T>;
}

export const useDroneStore = create<DroneStoreState>((set, get) => ({
  client: null,
  status: null,
  history: [],
  drops: [],
  backendOnline: false,
  stale: false,
  lastDrop: null,
  error: null,
  connecting: true,
  lastStatusAt: 0,
  setClient: (client) => set({ client }),
  setConnecting: (connecting) => set({ connecting }),
  setBackendOnline: (online) => set({ backendOnline: online }),
  setStatus: (status) =>
    set((state) => {
      const sample = sampleFromStatus(status);
      const last = state.history[state.history.length - 1];
      const resume = last && sample.time - last.time > 10 * 60 * 1000;
      const base = resume ? [] : state.history;
      const history = [...base, sample].slice(-MAX_HISTORY);
      return { status, stale: false, lastStatusAt: sample.time, history };
    }),
  setLastDrop: (lastDrop) => set({ lastDrop }),
  pushDrop: (drop) =>
    set((state) => ({
      drops: state.drops.some((d) => d.time === drop.time) ? state.drops : [...state.drops, drop],
      lastDrop: drop,
    })),
  resetDrops: () => set({ drops: [] }),
  setError: (error) => set({ error }),
  setStale: (stale) => set({ stale }),
  send: async <T>(cmd: CommandName, body?: object, timeoutMs = 5000): Promise<T> => {
    const client = get().client;
    if (!client) {
      throw new Error("Koneksi drone belum siap");
    }
    return client.send<T>(cmd, body ?? {}, timeoutMs);
  },
}));
