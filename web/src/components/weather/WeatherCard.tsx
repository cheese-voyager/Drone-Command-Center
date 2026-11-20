import { Card } from "../ui/Card";
import type { WeatherState } from "../../hooks/useWeather";
import { distanceKm } from "../../utils/geo";
import { fmtNumber } from "../../utils/format";
import {
  assessSlot,
  fmtAnalysis,
  fmtSlotClock,
  fmtSlotDay,
  pickCurrentSlot,
  upcomingSlots,
  windText,
} from "../../utils/weather";

interface WeatherCardProps {
  weather: WeatherState;
  lat: number | null;
  lon: number | null;
  locationLabel?: string;
  className?: string;
  maxSlots?: number;
}

function fmtDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${fmtNumber(km)} km`;
}

export function WeatherCard({
  weather,
  lat,
  lon,
  locationLabel = "drone",
  className = "",
  maxSlots = 8,
}: WeatherCardProps) {
  const current = pickCurrentSlot(weather.slots);
  const upcoming = upcomingSlots(weather.slots, maxSlots);
  const strip = upcoming.length > 0 ? upcoming : weather.slots.slice(0, maxSlots);
  const place = weather.location;
  const distance = place && lat !== null && lon !== null ? distanceKm(lat, lon, place.lat, place.lon) : null;
  const risk = current ? assessSlot(current) : null;
  const loading = weather.status === "loading";

  return (
    <Card title="Cuaca area" meta="BMKG" className={className}>
      {lat === null || lon === null ? (
        <p className="muted">Menunggu posisi GPS drone untuk memuat prakiraan BMKG.</p>
      ) : weather.status === "error" ? (
        <div className="wx-state">
          <p className="banner banner-error">{weather.error}</p>
          <button type="button" className="wx-reload" onClick={weather.reload}>
            Coba lagi
          </button>
        </div>
      ) : !current || !place ? (
        <p className="muted">Memuat prakiraan BMKG…</p>
      ) : (
        <>
          <div className="wx-loc">
            <div>
              <div className="wx-place">
                {place.desa}, {place.kecamatan}
              </div>
              <div className="metric-sub">
                {place.kotkab} · {place.provinsi}
                {distance !== null ? ` — ${fmtDistance(distance)} dari ${locationLabel}` : ""}
              </div>
            </div>
            <button type="button" className="wx-reload" onClick={weather.reload} disabled={loading}>
              {loading ? "Memuat…" : "Muat ulang"}
            </button>
          </div>

          <div className="wx-now">
            {current.image ? (
              <img className="wx-icon" src={current.image} alt={current.weather_desc ?? "Cuaca"} loading="lazy" />
            ) : null}
            <div className="wx-temp">
              <b>{current.t ?? "-"}</b>
              <span>°C</span>
            </div>
            <div className="wx-desc">
              <span className="wx-desc-main">{current.weather_desc ?? "-"}</span>
              <span className="metric-sub">
                {fmtSlotClock(current)} WIB · {fmtSlotDay(current)}
              </span>
            </div>
          </div>

          <div className="wx-metrics">
            <div className="wx-metric">
              <span className="metric-label">Angin</span>
              <span className="wx-value">{windText(current)}</span>
            </div>
            <div className="wx-metric">
              <span className="metric-label">Kelembapan</span>
              <span className="wx-value">{current.hu !== null ? `${current.hu}%` : "-"}</span>
            </div>
            <div className="wx-metric">
              <span className="metric-label">Tutupan awan</span>
              <span className="wx-value">{current.tcc !== null ? `${current.tcc}%` : "-"}</span>
            </div>
            <div className="wx-metric">
              <span className="metric-label">Hujan</span>
              <span className="wx-value">{current.tp !== null ? `${current.tp} mm` : "-"}</span>
            </div>
            <div className="wx-metric">
              <span className="metric-label">Jarak pandang</span>
              <span className="wx-value">{current.vs_text ?? "-"}</span>
            </div>
          </div>

          {risk && risk.level !== "ok" ? (
            <p className={`wx-note ${risk.level}`}>
              {risk.level === "bad" ? "Tidak disarankan terbang" : "Perlu waspada"}: {risk.reasons.join(", ")}.
            </p>
          ) : null}

          {strip.length > 0 ? (
            <div className="wx-strip">
              {strip.map((slot, index) => {
                const day = fmtSlotDay(slot);
                const previousDay = index > 0 ? fmtSlotDay(strip[index - 1]) : "";
                return (
                  <div key={slot.datetime ?? slot.local_datetime ?? index} className="wx-cell" title={slot.weather_desc ?? ""}>
                    <span className="wx-cell-day">{day !== previousDay ? day : ""}</span>
                    <span className="wx-cell-time">{fmtSlotClock(slot)}</span>
                    {slot.image ? <img src={slot.image} alt="" loading="lazy" /> : null}
                    <span className="wx-cell-temp">{slot.t !== null ? `${slot.t}°` : "-"}</span>
                  </div>
                );
              })}
            </div>
          ) : null}

          <p className="wx-src">Sumber: BMKG · rilis {fmtAnalysis(current.analysis_date)}</p>
        </>
      )}
    </Card>
  );
}
