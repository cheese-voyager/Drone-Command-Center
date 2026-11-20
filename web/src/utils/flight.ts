import { distanceKm } from "./geo";
import type { DropRecord, TelemetrySample } from "../types";

export interface FlightPathPoint {
  time: number;
  lat: number;
  lon: number;
  alt: number | null;
  speed: number | null;
}

export interface FlightSummary {
  start: number | null;
  end: number | null;
  duration_s: number;
  distance_km: number;
  max_alt: number | null;
  min_alt: number | null;
  avg_speed: number | null;
  max_speed: number | null;
  battery_start: number | null;
  battery_end: number | null;
  drop_count: number;
  points: number;
}

export function flightPathFromHistory(history: TelemetrySample[]): FlightPathPoint[] {
  const points: FlightPathPoint[] = [];
  for (const sample of history) {
    if (sample.lat === null || sample.lon === null) continue;
    if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lon)) continue;
    points.push({
      time: sample.time,
      lat: sample.lat,
      lon: sample.lon,
      alt: sample.alt,
      speed: sample.speed,
    });
  }
  return points;
}

export function pathDistanceKm(points: { lat: number; lon: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += distanceKm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }
  return total;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeFlight(
  points: FlightPathPoint[],
  history: TelemetrySample[],
  drops: DropRecord[],
): FlightSummary {
  const start = points.length > 0 ? points[0].time : history.length > 0 ? history[0].time : null;
  const end =
    points.length > 0
      ? points[points.length - 1].time
      : history.length > 0
        ? history[history.length - 1].time
        : null;
  const duration_s = start !== null && end !== null ? Math.max(0, (end - start) / 1000) : 0;
  const alts = points.map((p) => p.alt).filter((v): v is number => v !== null && Number.isFinite(v));
  const speeds = points.map((p) => p.speed).filter((v): v is number => v !== null && Number.isFinite(v));
  const batteries = history
    .map((s) => s.battery)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  return {
    start,
    end,
    duration_s,
    distance_km: pathDistanceKm(points),
    max_alt: alts.length > 0 ? Math.max(...alts) : null,
    min_alt: alts.length > 0 ? Math.min(...alts) : null,
    avg_speed: average(speeds),
    max_speed: speeds.length > 0 ? Math.max(...speeds) : null,
    battery_start: batteries.length > 0 ? batteries[0] : null,
    battery_end: batteries.length > 0 ? batteries[batteries.length - 1] : null,
    drop_count: drops.length,
    points: points.length,
  };
}

export function sampledPoints(points: FlightPathPoint[], limit = 600): FlightPathPoint[] {
  if (points.length <= limit) return points;
  const step = Math.ceil(points.length / limit);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) sampled.push(last);
  return sampled;
}
