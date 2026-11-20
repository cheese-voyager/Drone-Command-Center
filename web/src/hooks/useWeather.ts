import { useCallback, useEffect, useRef, useState } from "react";
import { fetchForecast, reverseGeocode, type BmkgLocation, type BmkgSlot } from "../api/bmkg";

const REFRESH_MS = 30 * 60 * 1000;
const GEO_CELL_DECIMALS = 2;

export interface WeatherState {
  status: "idle" | "loading" | "ready" | "error";
  location: BmkgLocation | null;
  slots: BmkgSlot[];
  error: string | null;
  updatedAt: number | null;
  reload: () => void;
}

type WeatherData = Omit<WeatherState, "reload">;

const IDLE: WeatherData = {
  status: "idle",
  location: null,
  slots: [],
  error: null,
  updatedAt: null,
};

/**
 * Ambil prakiraan BMKG untuk posisi drone. Reverse-geocode koordinat -> kode adm4
 * dilakukan otomatis oleh layanan BMKG, lalu prakiraan 3 hari diambil dari API publik.
 * Data di-cache di lapisan api dan disegarkan tiap 30 menit.
 */
export function useWeather(lat: number | null, lon: number | null): WeatherState {
  const [data, setData] = useState<WeatherData>(IDLE);
  const [nonce, setNonce] = useState(0);
  const forceRef = useRef(false);
  const coordRef = useRef<{ lat: number | null; lon: number | null }>({ lat, lon });
  coordRef.current = { lat, lon };

  const reload = useCallback(() => {
    forceRef.current = true;
    setNonce((value) => value + 1);
  }, []);

  const valid = lat !== null && lon !== null && Number.isFinite(lat) && Number.isFinite(lon);
  const key = valid ? `${lat.toFixed(GEO_CELL_DECIMALS)},${lon.toFixed(GEO_CELL_DECIMALS)}` : null;

  useEffect(() => {
    if (key === null) {
      setData(IDLE);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    let timer: number | null = null;

    const load = async (force: boolean) => {
      const coords = coordRef.current;
      if (coords.lat === null || coords.lon === null) return;
      setData((prev) =>
        prev.slots.length > 0
          ? { ...prev, error: null }
          : { ...prev, status: "loading", error: null },
      );
      try {
        const place = await reverseGeocode(coords.lat, coords.lon, { signal: controller.signal, force });
        const forecast = await fetchForecast(place.adm4, { signal: controller.signal, force });
        if (cancelled) return;
        setData({
          status: "ready",
          location: { ...forecast.lokasi, distance: place.distance },
          slots: forecast.slots,
          error: null,
          updatedAt: Date.now(),
        });
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setData((prev) => ({
          ...prev,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    };

    const force = forceRef.current;
    forceRef.current = false;
    void load(force);
    timer = window.setInterval(() => void load(false), REFRESH_MS);

    return () => {
      cancelled = true;
      controller.abort();
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [key, nonce]);

  return { ...data, reload };
}
