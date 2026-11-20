import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DroneStatus } from "../types";
import { distanceKm } from "../utils/geo";

export interface FlightLogPoint {
  time: number;
  lat: number;
  lon: number;
  alt: number | null;
  speed: number | null;
}

export interface FlightLogSession {
  id: string;
  startedAt: number;
  endedAt: number;
  duration_s: number;
  distance_km: number;
  max_alt: number | null;
  avg_speed: number | null;
  seeds_start: number | null;
  seeds_end: number | null;
  seeds_dropped: number | null;
  points: FlightLogPoint[];
}

interface ActiveFlight extends FlightLogSession {
  lastSampleAt: number;
  lastUpdateAt: number;
  lastPointAt: number;
  lastLat: number;
  lastLon: number;
  lastSeed: number | null;
  speedSum: number;
  speedCount: number;
}

interface FlightLogState {
  sessions: FlightLogSession[];
  active: ActiveFlight | null;
  ingest: (status: DroneStatus) => void;
  finalizeIdle: () => void;
  clear: () => void;
}

const GAP_MS = 60_000;
const IDLE_MS = 60_000;
const MIN_SESSION_MS = 5_000;
const INGEST_THROTTLE_MS = 900;
const POINT_INTERVAL_MS = 5_000;
const MAX_POINTS = 720;
const MAX_SESSIONS = 40;

function pointFrom(status: DroneStatus, time: number): FlightLogPoint {
  return {
    time,
    lat: status.lat as number,
    lon: status.lon as number,
    alt: status.alt,
    speed: status.speed,
  };
}

function startActive(status: DroneStatus, now: number): ActiveFlight {
  const seed = status.seed?.remaining ?? null;
  return {
    id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    startedAt: now,
    endedAt: now,
    duration_s: 0,
    distance_km: 0,
    max_alt: status.alt ?? null,
    avg_speed: null,
    seeds_start: seed,
    seeds_end: seed,
    seeds_dropped: seed === null ? null : 0,
    points: [pointFrom(status, now)],
    lastSampleAt: now,
    lastUpdateAt: now,
    lastPointAt: now,
    lastLat: status.lat as number,
    lastLon: status.lon as number,
    lastSeed: seed,
    speedSum: status.speed ?? 0,
    speedCount: status.speed === null ? 0 : 1,
  };
}

function toSession(active: ActiveFlight): FlightLogSession {
  return {
    id: active.id,
    startedAt: active.startedAt,
    endedAt: active.endedAt,
    duration_s: Math.max(0, (active.endedAt - active.startedAt) / 1000),
    distance_km: active.distance_km,
    max_alt: active.max_alt,
    avg_speed: active.speedCount > 0 ? active.speedSum / active.speedCount : null,
    seeds_start: active.seeds_start,
    seeds_end: active.seeds_end,
    seeds_dropped: active.seeds_dropped,
    points: active.points,
  };
}

function commit(active: ActiveFlight, sessions: FlightLogSession[]): FlightLogSession[] {
  if (active.endedAt - active.startedAt < MIN_SESSION_MS) {
    return sessions;
  }
  return [toSession(active), ...sessions].slice(0, MAX_SESSIONS);
}

export const useFlightLogStore = create<FlightLogState>()(
  persist(
    (set) => ({
      sessions: [],
      active: null,
      ingest: (status) => {
        const now = Date.now();
        const lat = status.lat;
        const lon = status.lon;
        const valid =
          status.connected &&
          status.armed &&
          lat !== null &&
          lon !== null &&
          Number.isFinite(lat) &&
          Number.isFinite(lon);

        if (!valid) {
          set((state) => {
            if (state.active && now - state.active.lastSampleAt > IDLE_MS) {
              return { sessions: commit(state.active, state.sessions), active: null };
            }
            return {};
          });
          return;
        }

        set((state) => {
          let sessions = state.sessions;
          let active = state.active;

          if (active && now - active.lastSampleAt > GAP_MS) {
            sessions = commit(active, sessions);
            active = null;
          }

          if (!active) {
            return { sessions, active: startActive(status, now) };
          }

          if (now - active.lastUpdateAt < INGEST_THROTTLE_MS) {
            return {};
          }

          const seed = status.seed?.remaining ?? null;
          let seedsStart = active.seeds_start;
          let seedsEnd = active.seeds_end;
          let seedsDropped = active.seeds_dropped;
          let lastSeed = active.lastSeed;

          if (seed !== null) {
            if (lastSeed === null) {
              seedsStart = seed;
              seedsDropped = 0;
            } else if (seed < lastSeed) {
              seedsDropped = (seedsDropped ?? 0) + (lastSeed - seed);
            }
            lastSeed = seed;
            seedsEnd = seed;
          }

          const altitude = status.alt;
          const speed = status.speed;
          const point = pointFrom(status, now);
          const addPoint = now - active.lastPointAt >= POINT_INTERVAL_MS;
          const points = addPoint ? [...active.points, point].slice(-MAX_POINTS) : active.points;
          const speedSum = active.speedSum + (speed ?? 0);
          const speedCount = active.speedCount + (speed === null ? 0 : 1);

          return {
            active: {
              ...active,
              endedAt: now,
              duration_s: (now - active.startedAt) / 1000,
              distance_km: active.distance_km + distanceKm(active.lastLat, active.lastLon, point.lat, point.lon),
              max_alt:
                altitude === null || !Number.isFinite(altitude)
                  ? active.max_alt
                  : Math.max(active.max_alt ?? altitude, altitude),
              seeds_start: seedsStart,
              seeds_end: seedsEnd,
              seeds_dropped: seedsDropped,
              points,
              lastSampleAt: now,
              lastUpdateAt: now,
              lastPointAt: addPoint ? now : active.lastPointAt,
              lastLat: point.lat,
              lastLon: point.lon,
              lastSeed,
              speedSum,
              speedCount,
              avg_speed: speedCount > 0 ? speedSum / speedCount : null,
            },
          };
        });
      },
      finalizeIdle: () => {
        set((state) => {
          if (!state.active || Date.now() - state.active.lastSampleAt < IDLE_MS) {
            return {};
          }
          return { sessions: commit(state.active, state.sessions), active: null };
        });
      },
      clear: () => set({ sessions: [], active: null }),
    }),
    {
      name: "drone-flight-log",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ sessions: state.sessions, active: state.active }),
      onRehydrateStorage: () => (state) => {
        state?.finalizeIdle();
      },
    },
  ),
);
