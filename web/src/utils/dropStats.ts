import type { DropRecord } from "../types";

export interface DropSummary {
  count: number;
  total_duration_s: number;
  avg_thrust: number | null;
  first: number | null;
  last: number | null;
  located: number;
}

export interface DropBucket {
  label: string;
  value: number;
}

export function summarizeDrops(drops: DropRecord[]): DropSummary {
  if (drops.length === 0) {
    return { count: 0, total_duration_s: 0, avg_thrust: null, first: null, last: null, located: 0 };
  }
  const times = drops.map((d) => d.time);
  const thrust = drops.reduce((sum, d) => sum + d.thrust, 0) / drops.length;
  return {
    count: drops.length,
    total_duration_s: drops.reduce((sum, d) => sum + d.duration, 0),
    avg_thrust: Number.isFinite(thrust) ? thrust : null,
    first: Math.min(...times),
    last: Math.max(...times),
    located: drops.filter((d) => d.lat !== null && d.lon !== null).length,
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function dropBuckets(drops: DropRecord[], buckets = 8): DropBucket[] {
  if (drops.length === 0) return [];
  const times = drops.map((d) => d.time * 1000).sort((a, b) => a - b);
  const first = times[0];
  const last = times[times.length - 1];
  const span = Math.max(last - first, 60 * 1000);
  const size = span / buckets;

  return Array.from({ length: buckets }, (_, index) => {
    const from = first + index * size;
    const to = index === buckets - 1 ? last + 1 : from + size;
    const value = times.filter((t) => t >= from && t < to).length;
    const date = new Date(from + 7 * 60 * 60 * 1000);
    return { label: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`, value };
  });
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibDate(seconds: number): Date {
  return new Date(seconds * 1000 + WIB_OFFSET_MS);
}

function wibDayLabel(date: Date): string {
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`;
}

export function dropBucketsByHour(drops: DropRecord[]): DropBucket[] {
  if (drops.length === 0) return [];
  const groups = new Map<string, { date: Date; count: number }>();
  for (const drop of drops) {
    const date = wibDate(drop.time);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
    } else {
      groups.set(key, { date, count: 1 });
    }
  }

  const values = [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const multiDay = new Set(values.map((entry) => wibDayLabel(entry.date))).size > 1;
  return values.map((entry) => ({
    label: multiDay ? `${wibDayLabel(entry.date)} ${pad(entry.date.getUTCHours())}:00` : `${pad(entry.date.getUTCHours())}:00`,
    value: entry.count,
  }));
}

export function dropBucketsByDay(drops: DropRecord[]): DropBucket[] {
  if (drops.length === 0) return [];
  const groups = new Map<string, { date: Date; count: number }>();
  for (const drop of drops) {
    const date = wibDate(drop.time);
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    const current = groups.get(key);
    if (current) {
      current.count += 1;
    } else {
      groups.set(key, { date, count: 1 });
    }
  }
  return [...groups.values()]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((entry) => ({ label: wibDayLabel(entry.date), value: entry.count }));
}
