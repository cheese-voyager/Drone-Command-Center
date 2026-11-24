import { Card } from "../../components/ui/Card";
import { WeatherCard } from "../../components/weather/WeatherCard";
import { DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useDroneStore } from "../../store/droneStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useWeather } from "../../hooks/useWeather";
import { DEFAULT_MAP_CENTER } from "../../utils/constants";
import { fmtCoord, fmtNumber } from "../../utils/format";
import { isValidCoord } from "../../utils/geo";
import { assessSlot, fmtSlotClock, fmtSlotDay, pickCurrentSlot, windText } from "../../utils/weather";

export function WeatherDetailPage() {
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
  const currentRisk = current ? assessSlot(current) : null;
  const place = weather.location;

  return (
    <div className="detail-page">
      {weatherUseManual && !manualValid ? (
        <p className="banner banner-error">Koordinat manual belum valid. Perbaiki di Pengaturan atau matikan koordinat manual.</p>
      ) : null}
      {usingDefault ? (
        <p className="banner banner-warning">GPS drone belum tersedia. Prakiraan memakai lokasi default ITENAS Bandung.</p>
      ) : null}

      <Card title="Lokasi prakiraan" meta={weatherUseManual ? "Koordinat manual" : usingDefault ? "Lokasi default" : "GPS drone"}>
        <DetailMetrics
          items={[
            { label: "Koordinat", value: fmtCoord(lat, lon) },
            { label: "Wilayah", value: place ? `${place.desa}, ${place.kecamatan}` : "-" },
            { label: "Kabupaten", value: place?.kotkab ?? "-" },
            { label: "Provinsi", value: place?.provinsi ?? "-" },
            {
              label: "Jarak dari titik",
              value: place?.distance === undefined ? "-" : `${fmtNumber(place.distance, 1)} km`,
            },
            { label: "Kode BMKG", value: place?.adm4 ?? "-" },
          ]}
        />
      </Card>

      <WeatherCard weather={weather} lat={lat} lon={lon} maxSlots={12} />

      <Card title="Kondisi saat ini" meta={current ? fmtSlotDay(current) : "Menunggu data"}>
        {!current ? (
          <DetailEmpty>{weather.status === "loading" ? "Memuat prakiraan BMKG..." : "Belum ada prakiraan untuk lokasi ini."}</DetailEmpty>
        ) : (
          <DetailMetrics
            items={[
              { label: "Jam", value: fmtSlotClock(current) },
              { label: "Cuaca", value: current.weather_desc ?? "-" },
              { label: "Suhu", value: current.t === null ? "-" : `${current.t}°C` },
              { label: "Angin", value: windText(current) },
              { label: "Kelembapan", value: current.hu === null ? "-" : `${current.hu}%` },
              { label: "Hujan", value: current.tp === null ? "-" : `${current.tp} mm` },
              { label: "Pandang", value: current.vs_text ?? "-" },
              { label: "Status", value: currentRisk ? (currentRisk.level === "bad" ? "Buruk" : currentRisk.level === "warn" ? "Waspada" : "Aman") : "-" },
            ]}
          />
        )}
        {currentRisk && currentRisk.reasons.length > 0 ? (
          <p className={`wx-note ${currentRisk.level}`}>
            {currentRisk.level === "bad" ? "Tidak disarankan terbang" : "Perlu waspada"}: {currentRisk.reasons.join(", ")}.
          </p>
        ) : null}
      </Card>

      <Card title="Semua slot prakiraan" meta={`${weather.slots.length} slot`}>
        {weather.slots.length === 0 ? (
          <DetailEmpty>Belum ada data prakiraan.</DetailEmpty>
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
                      <td className="num">{slot.t === null ? "-" : `${slot.t}°C`}</td>
                      <td>{windText(slot)}</td>
                      <td className="num">{slot.hu === null ? "-" : `${slot.hu}%`}</td>
                      <td className="num">{slot.tp === null ? "-" : `${slot.tp} mm`}</td>
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
      </Card>
    </div>
  );
}
