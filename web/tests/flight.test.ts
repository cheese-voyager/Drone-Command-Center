import { describe, expect, it } from "vitest";
import type { DropRecord, TelemetrySample } from "../src/types";
import { flightPathFromHistory, pathDistanceKm, sampledPoints, summarizeFlight } from "../src/utils/flight";
import { dropBuckets, dropBucketsByDay, dropBucketsByHour, summarizeDrops } from "../src/utils/dropStats";

function sample(overrides: Partial<TelemetrySample> = {}): TelemetrySample {
  return {
    time: 1_700_000_000_000,
    lat: -6.9175,
    lon: 107.6191,
    alt: 12,
    speed: 3,
    yaw: 90,
    voltage: 19.5,
    current: 20,
    battery: 80,
    satellites: 12,
    gps_fix: 3,
    mode: "GUIDED",
    armed: false,
    motors: null,
    seed_remaining: 100,
    ...overrides,
  };
}

function drop(overrides: Partial<DropRecord> = {}): DropRecord {
  return { time: 1_700_000_000, lat: -6.9175, lon: 107.6191, thrust: 70, duration: 1.5, ...overrides };
}

describe("flight helpers", () => {
  it("builds path only from samples with coordinates", () => {
    const path = flightPathFromHistory([
      sample({ time: 1000, alt: 10 }),
      sample({ time: 2000, lat: null, lon: null }),
      sample({ time: 3000, lat: -6.9185, lon: 107.6191, alt: 20 }),
    ]);
    expect(path).toHaveLength(2);
    expect(path[0].time).toBe(1000);
    expect(path[1].alt).toBe(20);
  });

  it("computes distance between points", () => {
    const km = pathDistanceKm([
      { lat: -6.9175, lon: 107.6191 },
      { lat: -6.9185, lon: 107.6191 },
    ]);
    expect(km).toBeGreaterThan(0.1);
    expect(km).toBeLessThan(0.12);
  });

  it("summarizes duration, altitude, speed, and battery", () => {
    const history = [
      sample({ time: 1000, alt: 10, speed: 2, battery: 90 }),
      sample({ time: 2000, alt: 30, speed: 4, battery: 85 }),
      sample({ time: 3000, alt: 20, speed: 6, battery: 80 }),
    ];
    const path = flightPathFromHistory(history);
    const summary = summarizeFlight(path, history, [drop()]);
    expect(summary.duration_s).toBe(2);
    expect(summary.max_alt).toBe(30);
    expect(summary.min_alt).toBe(10);
    expect(summary.avg_speed).toBe(4);
    expect(summary.max_speed).toBe(6);
    expect(summary.battery_start).toBe(90);
    expect(summary.battery_end).toBe(80);
    expect(summary.drop_count).toBe(1);
    expect(summary.points).toBe(3);
  });

  it("samples long paths but keeps the last point", () => {
    const path = flightPathFromHistory(
      Array.from({ length: 50 }, (_, index) => sample({ time: 1000 + index * 1000, lat: -6.9175 + index * 0.00001 })),
    );
    const sampled = sampledPoints(path, 10);
    expect(sampled.length).toBeLessThanOrEqual(12);
    expect(sampled[sampled.length - 1]).toEqual(path[path.length - 1]);
  });

  it("summarizes drops and builds interval buckets", () => {
    const drops = [
      drop({ time: 1000, lat: null, lon: null }),
      drop({ time: 1060, thrust: 50 }),
      drop({ time: 1800, thrust: 90 }),
    ];
    const summary = summarizeDrops(drops);
    expect(summary.count).toBe(3);
    expect(summary.located).toBe(2);
    expect(summary.avg_thrust).toBeCloseTo(70);
    expect(summary.total_duration_s).toBeCloseTo(4.5);
    expect(summary.first).toBe(1000);
    expect(summary.last).toBe(1800);

    const buckets = dropBuckets(drops, 4);
    expect(buckets).toHaveLength(4);
    expect(buckets.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(3);
  });

  it("buckets drops by WIB hour and day", () => {
    const drops = [
      drop({ time: Date.parse("2026-01-01T00:10:00Z") / 1000 }),
      drop({ time: Date.parse("2026-01-01T00:50:00Z") / 1000 }),
      drop({ time: Date.parse("2026-01-01T17:10:00Z") / 1000 }),
    ];

    expect(dropBucketsByHour(drops)).toEqual([
      { label: "01/01 07:00", value: 2 },
      { label: "02/01 00:00", value: 1 },
    ]);
    expect(dropBucketsByDay(drops)).toEqual([
      { label: "01/01", value: 2 },
      { label: "02/01", value: 1 },
    ]);
  });
});
