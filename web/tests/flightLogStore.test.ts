import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DroneStatus } from "../src/types";
import { useFlightLogStore } from "../src/store/flightLogStore";

function status(overrides: Partial<DroneStatus> = {}): DroneStatus {
  return {
    connected: true,
    mode: "GUIDED",
    armed: true,
    lat: -6.2,
    lon: 106.816666,
    alt: 12,
    pitch: 0,
    roll: 0,
    yaw: 90,
    speed: 3,
    voltage: 22,
    current: 10,
    gps_fix: 3,
    satellites: 12,
    motors: null,
    battery: {
      capacity_mah: 5000,
      used_mah: 1000,
      remaining_mah: 4000,
      remaining_percent: 80,
      avg_current: 10,
      estimated_minutes_left: 24,
      low: false,
    },
    seed: { loaded: 100, dropped: 0, remaining: 100 },
    avg_speed: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  localStorage.clear();
  useFlightLogStore.setState({ sessions: [], active: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("flightLogStore", () => {
  it("does not record a session while the drone is disarmed", () => {
    useFlightLogStore.getState().ingest(status({ armed: false }));
    expect(useFlightLogStore.getState().active).toBeNull();
  });

  it("records an armed flight with distance, duration, and dropped seeds", () => {
    useFlightLogStore.getState().ingest(status());
    expect(useFlightLogStore.getState().active).not.toBeNull();

    vi.advanceTimersByTime(2_000);
    useFlightLogStore.getState().ingest(
      status({ lat: -6.201, seed: { loaded: 100, dropped: 5, remaining: 95 } }),
    );

    const active = useFlightLogStore.getState().active;
    expect(active?.seeds_dropped).toBe(5);
    expect(active?.distance_km).toBeGreaterThan(0);
    expect(active?.duration_s).toBeGreaterThanOrEqual(2);

    vi.advanceTimersByTime(4_000);
    useFlightLogStore.getState().ingest(
      status({ lat: -6.202, seed: { loaded: 100, dropped: 5, remaining: 95 } }),
    );
    vi.advanceTimersByTime(61_000);
    useFlightLogStore.getState().finalizeIdle();

    const state = useFlightLogStore.getState();
    expect(state.active).toBeNull();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].seeds_dropped).toBe(5);
  });

  it("discards sessions shorter than five seconds", () => {
    useFlightLogStore.getState().ingest(status());
    vi.advanceTimersByTime(1_000);
    useFlightLogStore.getState().ingest(status({ armed: false }));
    vi.advanceTimersByTime(61_000);
    useFlightLogStore.getState().finalizeIdle();

    const state = useFlightLogStore.getState();
    expect(state.active).toBeNull();
    expect(state.sessions).toHaveLength(0);
  });
});
