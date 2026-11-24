import { useMemo, useState } from "react";
import { Card } from "../../components/ui/Card";
import { LineChart } from "../../components/charts/LineChart";
import { DroneMap } from "../../components/map/DroneMap";
import { SiteMarker } from "../../components/map/SiteMarker";
import { FlightPath } from "../../components/map/FlightPath";
import { DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useFlightLogStore } from "../../store/flightLogStore";
import { DEFAULT_MAP_CENTER } from "../../utils/constants";
import { fmtCoord, fmtDateTime, fmtDuration, fmtInt, fmtNumber } from "../../utils/format";

export function FlightDetailPage() {
  const sessions = useFlightLogStore((state) => state.sessions);
  const active = useFlightLogStore((state) => state.active);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const flights = useMemo(() => (active ? [active, ...sessions] : sessions), [active, sessions]);
  const selected = flights.find((flight) => flight.id === selectedId) ?? flights[0] ?? null;
  const labels = selected?.points.map((point) => new Date(point.time).toLocaleTimeString("id-ID", { hour12: false })) ?? [];
  const startPoint = selected?.points[0] ?? null;
  const endPoint = selected?.points[selected.points.length - 1] ?? null;
  const mapCenter = startPoint
    ? { lat: startPoint.lat, lon: startPoint.lon }
    : { lat: DEFAULT_MAP_CENTER.lat, lon: DEFAULT_MAP_CENTER.lon };

  const totalDuration = flights.reduce((sum, flight) => sum + flight.duration_s, 0);
  const totalDistance = flights.reduce((sum, flight) => sum + flight.distance_km, 0);
  const totalSeeds = flights.reduce((sum, flight) => sum + (flight.seeds_dropped ?? 0), 0);

  return (
    <div className="detail-page">
      <Card title="Ringkasan semua sesi" meta="Data tersimpan di browser">
        <DetailMetrics
          items={[
            { label: "Jumlah sesi", value: flights.length },
            { label: "Total durasi", value: fmtDuration(totalDuration) },
            { label: "Total jarak", value: `${fmtNumber(totalDistance, 2)} km` },
            { label: "Total benih", value: fmtInt(totalSeeds) },
          ]}
        />
      </Card>

      <Card title="Daftar sesi" meta={`${flights.length} sesi`}>
        {flights.length === 0 ? (
          <DetailEmpty>
            Belum ada sesi. Riwayat tercatat otomatis saat drone armed dan telemetri GPS masuk.
          </DetailEmpty>
        ) : (
          <div className="scroll-y">
            <table className="table flight-table">
              <thead>
                <tr>
                  <th>Mulai</th>
                  <th>Durasi</th>
                  <th>Jarak</th>
                  <th>Benih</th>
                  <th>Maks alt</th>
                  <th>Kecepatan</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => {
                  const live = flight.id === active?.id;
                  return (
                    <tr
                      key={flight.id}
                      className={flight.id === selected?.id ? "selected" : ""}
                      aria-selected={flight.id === selected?.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(flight.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(flight.id);
                        }
                      }}
                    >
                      <td className="num">
                        {fmtDateTime(flight.startedAt / 1000)}
                        {live ? <span className="badge badge-ok" style={{ marginLeft: 6 }}>Live</span> : null}
                      </td>
                      <td className="num">{fmtDuration(flight.duration_s)}</td>
                      <td className="num">{fmtNumber(flight.distance_km, 2)} km</td>
                      <td className="num">{fmtInt(flight.seeds_dropped)}</td>
                      <td className="num">{flight.max_alt === null ? "-" : `${fmtNumber(flight.max_alt, 0)} m`}</td>
                      <td className="num">
                        {flight.avg_speed === null ? "-" : `${fmtNumber(flight.avg_speed, 1)} m/s`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Detail sesi" meta={selected ? (selected.id === active?.id ? "Sedang berlangsung" : "Selesai") : undefined}>
        {!selected ? (
          <DetailEmpty>Pilih sesi untuk melihat detail.</DetailEmpty>
        ) : (
          <div className="flight-detail">
            <DetailMetrics
              className="grid-4"
              items={[
                { label: "Mulai", value: fmtDateTime(selected.startedAt / 1000) },
                { label: "Durasi", value: fmtDuration(selected.duration_s) },
                { label: "Jarak", value: `${fmtNumber(selected.distance_km, 2)} km` },
                { label: "Benih ditebar", value: fmtInt(selected.seeds_dropped) },
                {
                  label: "Sisa benih",
                  value: `${fmtInt(selected.seeds_start)} → ${fmtInt(selected.seeds_end)}`,
                },
                { label: "Ketinggian maks", value: selected.max_alt === null ? "-" : `${fmtNumber(selected.max_alt, 0)} m` },
                { label: "Kecepatan rata-rata", value: `${fmtNumber(selected.avg_speed)} m/s` },
                { label: "Titik sampel", value: selected.points.length },
              ]}
            />

            <div className="flight-coords">
              <span>Awal: {fmtCoord(startPoint?.lat ?? null, startPoint?.lon ?? null)}</span>
              <span>Akhir: {fmtCoord(endPoint?.lat ?? null, endPoint?.lon ?? null)}</span>
            </div>

            <div className="detail-map-overview">
              <DroneMap center={mapCenter} zoom={15} className="map-overview" showScale>
                <SiteMarker site={DEFAULT_MAP_CENTER} label="ITENAS Bandung" />
                <FlightPath points={selected.points} />
              </DroneMap>
            </div>

            <div className="fit-2col" style={{ flex: "none", gap: "var(--space-4)" }}>
              <LineChart
                series={[{ label: "Ketinggian", color: "var(--primary)", values: selected.points.map((point) => point.alt) }]}
                labels={labels}
                height={140}
                format={(value) => `${value.toFixed(0)} m`}
              />
              <LineChart
                series={[{ label: "Kecepatan", color: "var(--warn)", values: selected.points.map((point) => point.speed) }]}
                labels={labels}
                height={140}
                format={(value) => `${value.toFixed(1)} m/s`}
              />
            </div>

            <div className="scroll-y">
              <table className="table">
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Koordinat</th>
                    <th>Ketinggian</th>
                    <th>Kecepatan</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.points
                    .slice()
                    .reverse()
                    .map((point) => (
                      <tr key={point.time}>
                        <td className="num">{fmtDateTime(point.time / 1000)}</td>
                        <td className="num">{fmtCoord(point.lat, point.lon)}</td>
                        <td className="num">{point.alt === null ? "-" : `${fmtNumber(point.alt, 1)} m`}</td>
                        <td className="num">{point.speed === null ? "-" : `${fmtNumber(point.speed, 1)} m/s`}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
