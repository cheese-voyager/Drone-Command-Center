import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { WeatherCard } from "../components/weather/WeatherCard";
import { useDroneStore } from "../store/droneStore";
import { useSettingsStore } from "../store/settingsStore";
import { useWeather } from "../hooks/useWeather";
import { DEFAULT_MAP_CENTER } from "../utils/constants";
import { fmtCoord } from "../utils/format";
import { isValidCoord } from "../utils/geo";
import { assessSlot, fmtSlotClock, fmtSlotDay, pickCurrentSlot, windText } from "../utils/weather";

export function WeatherPage() {
  const status = useDroneStore((state) => state.status);
  const weatherUseManual = useSettingsStore((state) => state.weatherUseManual);
  const weatherLat = useSettingsStore((state) => state.weatherLat);
  const weatherLon = useSettingsStore((state) => state.weatherLon);

  const manualLat = Number(weatherLat);
  const manualLon = Number(weatherLon);
  const manualFilled = weatherLat.trim() !== "" && weatherLon.trim() !== "";
  const manualValid = manualFilled && Number.isFinite(manualLat) && Number.isFinite(manualLon) && isValidCoord(manualLat, manualLon);
  const droneLat = status?.lat ?? null;
  const droneLon = status?.lon ?? null;
  const usingDefault = !weatherUseManual && (droneLat === null || droneLon === null);
  const lat = weatherUseManual ? (manualValid ? manualLat : null) : (droneLat ?? DEFAULT_MAP_CENTER.lat);
  const lon = weatherUseManual ? (manualValid ? manualLon : null) : (droneLon ?? DEFAULT_MAP_CENTER.lon);
  const weather = useWeather(lat, lon);
  const current = pickCurrentSlot(weather.slots);
  const currentRisk = assessSlot(current);
  const loading = weather.status === "loading";

  return (
    <div className="page-fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Cuaca</h1>
          <p className="page-sub">
            Prakiraan BMKG untuk{" "}
            {weatherUseManual ? "koordinat manual" : usingDefault ? "lokasi default ITENAS Bandung" : "posisi GPS drone"}.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-secondary" onClick={weather.reload} disabled={loading || lat === null || lon === null}>
            {loading ? "Memuat..." : "Muat ulang"}
          </button>
          <Link className="btn btn-secondary" to="/settings">
            Atur lokasi
          </Link>
        </div>
      </div>

      {weatherUseManual && !manualValid ? (
        <div className="banner banner-error">
          Koordinat manual belum valid. Isi latitude dan longitude di Pengaturan, atau matikan koordinat manual.
        </div>
      ) : null}
      {usingDefault ? (
        <div className="banner banner-warning">
          Posisi GPS drone belum tersedia. Menampilkan prakiraan untuk lokasi default ITENAS Bandung.
        </div>
      ) : null}

      <div className="fit-2col">
        <WeatherCard weather={weather} lat={lat} lon={lon} className="fit-card" maxSlots={8} />

        <Card
          title="Prakiraan detail"
          meta={weather.slots.length > 0 ? `${weather.slots.length} slot` : undefined}
          className="fit-card"
          actions={
            <span className="metric-sub">
              {lat !== null && lon !== null ? fmtCoord(lat, lon) : "Koordinat belum ada"}
            </span>
          }
        >
          {weather.slots.length === 0 ? (
            <div className="empty">{loading ? "Memuat prakiraan BMKG..." : "Belum ada prakiraan untuk lokasi ini."}</div>
          ) : (
            <div className="scroll-y weather-detail-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Hari</th>
                    <th>Jam</th>
                    <th>Cuaca</th>
                    <th>Suhu</th>
                    <th>Angin</th>
                    <th>Lembap</th>
                    <th>Hujan</th>
                    <th>Pandang</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {weather.slots.map((slot, index) => {
                    const risk = assessSlot(slot);
                    const badge = risk.level === "bad" ? "badge-error" : risk.level === "warn" ? "badge-warn" : "badge-ok";
                    return (
                      <tr key={slot.datetime ?? slot.local_datetime ?? index}>
                        <td className="num">{fmtSlotDay(slot)}</td>
                        <td className="num">{fmtSlotClock(slot)}</td>
                        <td>{slot.weather_desc ?? "-"}</td>
                        <td className="num">{slot.t !== null ? `${slot.t}°C` : "-"}</td>
                        <td>{windText(slot)}</td>
                        <td className="num">{slot.hu !== null ? `${slot.hu}%` : "-"}</td>
                        <td className="num">{slot.tp !== null ? `${slot.tp} mm` : "-"}</td>
                        <td>{slot.vs_text ?? "-"}</td>
                        <td>
                          <span className={`badge ${badge}`}>
                            {risk.level === "bad" ? "Buruk" : risk.level === "warn" ? "Waspada" : "Aman"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {current && currentRisk.reasons.length > 0 ? (
            <p className={`wx-note ${currentRisk.level}`}>
              {currentRisk.level === "bad" ? "Tidak disarankan terbang" : "Perlu waspada"}: {currentRisk.reasons.join(", ")}.
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
