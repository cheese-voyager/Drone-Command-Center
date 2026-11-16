import { create } from "zustand";
import type { DroneClient } from "../api/droneMqtt";
import type { CommandName, DropRecord, DroneStatus } from "../types";

interface DroneStoreState {
  client: DroneClient | null;
  status: DroneStatus | null;
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
  send: <T>(cmd: CommandName, body?: object, timeoutMs?: number) => Promise<T>;
}

export const useDroneStore = create<DroneStoreState>((set, get) => ({
  client: null,
  status: null,
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
  setStatus: (status) => set({ status, stale: false, lastStatusAt: Date.now() }),
  setLastDrop: (lastDrop) => set({ lastDrop }),
  pushDrop: (drop) =>
    set((state) => ({
      drops: state.drops.some((d) => d.time === drop.time) ? state.drops : [...state.drops, drop],
      lastDrop: drop,
    })),
  resetDrops: () => set({ drops: [] }),
  setError: (error) => set({ error }),
  send: async <T>(cmd: CommandName, body?: object, timeoutMs = 5000): Promise<T> => {
    const client = get().client;
    if (!client) {
      throw new Error("Koneksi drone belum siap");
    }
    return client.send<T>(cmd, body ?? {}, timeoutMs);
  },
}));
