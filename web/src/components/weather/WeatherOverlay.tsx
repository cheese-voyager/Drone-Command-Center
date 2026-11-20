import type { WeatherState } from "../../hooks/useWeather";
import { assessSlot, fmtAnalysis, pickCurrentSlot, windText } from "../../utils/weather";

interface WeatherOverlayProps {
  weather: WeatherState;
  lat: number | null;
  lon: number | null;
}

export function WeatherOverlay({ weather, lat, lon }: WeatherOverlayProps) {
  const current = pickCurrentSlot(weather.slots);
  const place = weather.location;

  if (lat === null || lon === null) {
    return (
      <div className="wx-overlay">
        <span className="wx-overlay-kicker">Cuaca BMKG</span>
        <span className="wx-overlay-muted">Menunggu posisi GPS drone.</span>
      </div>
    );
  }

  if (weather.status === "error") {
    return (
      <div className="wx-overlay">
        <div className="wx-overlay-head">
          <span className="wx-overlay-kicker">Cuaca BMKG</span>
          <button type="button" className="wx-reload" onClick={weather.reload}>
            Muat ulang
          </button>
        </div>
        <span className="wx-overlay-muted">{weather.error}</span>
      </div>
    );
  }

  if (!current || !place) {
    return (
      <div className="wx-overlay">
        <span className="wx-overlay-kicker">Cuaca BMKG</span>
        <span className="wx-overlay-muted">Memuat prakiraan…</span>
      </div>
    );
  }

  const risk = assessSlot(current);

  return (
    <div className="wx-overlay">
      <div className="wx-overlay-head">
        <span className="wx-overlay-kicker">Cuaca BMKG</span>
        <button type="button" className="wx-reload" onClick={weather.reload} disabled={weather.status === "loading"}>
          {weather.status === "loading" ? "Memuat…" : "Muat ulang"}
        </button>
      </div>
      <div className="wx-overlay-main">
        {current.image ? <img className="wx-icon" src={current.image} alt={current.weather_desc ?? "Cuaca"} loading="lazy" /> : null}
        <b>{current.t ?? "-"}°</b>
        <div>
          <strong>{current.weather_desc ?? "-"}</strong>
          <span>
            {place.desa}, {place.kecamatan}
          </span>
        </div>
      </div>
      <div className="wx-overlay-metrics">
        <span>
          Angin <b>{windText(current)}</b>
        </span>
        <span>
          Hujan <b>{current.tp !== null ? `${current.tp} mm` : "-"}</b>
        </span>
        <span>
          Lembap <b>{current.hu !== null ? `${current.hu}%` : "-"}</b>
        </span>
      </div>
      {risk.level !== "ok" ? (
        <p className={`wx-overlay-note ${risk.level}`}>
          {risk.level === "bad" ? "Tidak disarankan terbang" : "Perlu waspada"}: {risk.reasons.join(", ")}.
        </p>
      ) : null}
      <span className="wx-overlay-src">Sumber: BMKG · rilis {fmtAnalysis(current.analysis_date)}</span>
    </div>
  );
}
