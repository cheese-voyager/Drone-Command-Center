import type { DropRecord } from "../types/drop";

const WIB_MS = 7 * 60 * 60 * 1000;

export function fmtInt(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return String(Math.round(value));
}

export function fmtNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return value.toFixed(digits);
}

export function fmtPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${value.toFixed(1)}%`;
}

export function fmtCoord(lat: number | null | undefined, lon: number | null | undefined): string {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return "-";
  }
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) {
    return "-";
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m} m ${s.toFixed(1)} s`;
}

export function fmtClock(ts: number): string {
  const d = new Date(ts * 1000);
  const wib = new Date(d.getTime() + WIB_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(wib.getUTCHours())}:${p(wib.getUTCMinutes())}:${p(wib.getUTCSeconds())}`;
}

export function fmtDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  const wib = new Date(d.getTime() + WIB_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${wib.getUTCFullYear()}-${p(wib.getUTCMonth() + 1)}-${p(wib.getUTCDate())} ${p(wib.getUTCHours())}:${p(wib.getUTCMinutes())}:${p(wib.getUTCSeconds())}`;
}

export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) {
    return "-";
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} mnt`;
  }
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return `${h} jam ${m} mnt`;
}

export function toCsv(drops: DropRecord[]): string {
  const header = "waktu,lat,lon,thrust,durasi";
  const rows = drops.map((d) => {
    const lat = d.lat === null ? "" : d.lat.toFixed(6);
    const lon = d.lon === null ? "" : d.lon.toFixed(6);
    return [String(Math.round(d.time)), lat, lon, String(d.thrust), String(d.duration)].join(",");
  });
  return [header, ...rows].join("\n");
}
