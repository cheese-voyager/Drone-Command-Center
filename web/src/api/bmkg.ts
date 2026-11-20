// Klien prakiraan cuaca BMKG (frontend-only, lewat proxy Vite agar bebas CORS).
export interface BmkgLocation {
  adm1: string;
  adm2: string;
  adm3: string;
  adm4: string;
  provinsi: string;
  kotkab: string;
  kecamatan: string;
  desa: string;
  lat: number;
  lon: number;
  timezone?: string;
  distance?: number;
}

export interface BmkgSlot {
  datetime: string | null;
  t: number | null;
  tcc: number | null;
  tp: number | null;
  weather: number | null;
  weather_desc: string | null;
  weather_desc_en: string | null;
  wd_deg: number | null;
  wd: string | null;
  wd_to: string | null;
  ws: number | null;
  hu: number | null;
  vs: number | null;
  vs_text: string | null;
  time_index: string | null;
  analysis_date: string | null;
  image: string | null;
  utc_datetime: string | null;
  local_datetime: string | null;
}

export interface BmkgForecast {
  lokasi: BmkgLocation;
  slots: BmkgSlot[];
  adm4: string;
}

interface RawForecast {
  lokasi?: BmkgLocation;
  data?: { lokasi?: BmkgLocation; cuaca?: BmkgSlot[][] }[];
}

export type BmkgErrorCode = "coords" | "not_found" | "http" | "format" | "network";

export class BmkgError extends Error {
  code: BmkgErrorCode;

  constructor(code: BmkgErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const GEO_BASE = (import.meta.env.VITE_BMKG_GEO_BASE as string | undefined) ?? "/bmkg-geo";
const API_BASE = (import.meta.env.VITE_BMKG_API_BASE as string | undefined) ?? "/bmkg-api";

const GEO_TTL_MS = 30 * 60 * 1000;
const FORECAST_TTL_MS = 10 * 60 * 1000;
const GEO_CELL_DECIMALS = 3;

interface CacheEntry<T> {
  at: number;
  value: T;
}

const geoCache = new Map<string, CacheEntry<BmkgLocation>>();
const forecastCache = new Map<string, CacheEntry<BmkgForecast>>();

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new BmkgError("network", "Tidak bisa menghubungi layanan BMKG.");
  }
  if (!res.ok) {
    if (res.status === 404) {
      throw new BmkgError("not_found", "Lokasi drone tidak ditemukan di prakiraan BMKG.");
    }
    throw new BmkgError("http", `BMKG menolak permintaan (HTTP ${res.status}).`);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new BmkgError("format", "Respons BMKG bukan JSON yang valid.");
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
  force?: boolean;
}

export async function reverseGeocode(lat: number, lon: number, opts: RequestOptions = {}): Promise<BmkgLocation> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new BmkgError("coords", "Koordinat drone tidak valid.");
  }
  const key = `${lat.toFixed(GEO_CELL_DECIMALS)},${lon.toFixed(GEO_CELL_DECIMALS)}`;
  const hit = geoCache.get(key);
  if (!opts.force && hit && Date.now() - hit.at < GEO_TTL_MS) {
    return hit.value;
  }
  const url = `${GEO_BASE}/api/df/v1/adm/coord?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`;
  const location = await getJson<BmkgLocation>(url, opts.signal);
  if (!location || typeof location.adm4 !== "string" || location.adm4.length === 0) {
    throw new BmkgError("not_found", "Lokasi tidak memiliki kode prakiraan BMKG (adm4).");
  }
  geoCache.set(key, { at: Date.now(), value: location });
  return location;
}

export async function fetchForecast(adm4: string, opts: RequestOptions = {}): Promise<BmkgForecast> {
  if (!adm4) {
    throw new BmkgError("format", "Kode prakiraan BMKG kosong.");
  }
  const hit = forecastCache.get(adm4);
  if (!opts.force && hit && Date.now() - hit.at < FORECAST_TTL_MS) {
    return hit.value;
  }
  const url = `${API_BASE}/publik/prakiraan-cuaca?adm4=${encodeURIComponent(adm4)}`;
  const raw = await getJson<RawForecast>(url, opts.signal);
  const entry = raw.data?.[0];
  if (!entry || !Array.isArray(entry.cuaca) || !entry.lokasi) {
    throw new BmkgError("format", "Format prakiraan BMKG tidak dikenali.");
  }
  const slots = entry.cuaca.flat().filter((slot) => slot != null);
  if (slots.length === 0) {
    throw new BmkgError("format", "Prakiraan BMKG belum tersedia untuk lokasi ini.");
  }
  const value: BmkgForecast = {
    adm4,
    lokasi: entry.lokasi,
    slots,
  };
  forecastCache.set(adm4, { at: Date.now(), value });
  return value;
}

export function clearBmkgCache(): void {
  geoCache.clear();
  forecastCache.clear();
}
