import { useMemo, useState } from "react";
import { Card } from "../components/ui/Card";
import { LineChart } from "../components/charts/LineChart";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";
import { useFlightLogStore } from "../store/flightLogStore";
import { fmtCoord, fmtDateTime, fmtDuration, fmtInt, fmtNumber } from "../utils/format";
import { PageHeader } from "../components/layout/PageHeader";

export function FlightHistoryPage() {
  const sessions = useFlightLogStore((state) => state.sessions);
  const active = useFlightLogStore((state) => state.active);
  const clear = useFlightLogStore((state) => state.clear);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const flights = useMemo(() => (active ? [active, ...sessions] : sessions), [active, sessions]);
  const selected = flights.find((flight) => flight.id === selectedId) ?? flights[0] ?? null;
  const labels = selected?.points.map((point) => new Date(point.time).toLocaleTimeString("id-ID", { hour12: false })) ?? [];
  const startPoint = selected?.points[0] ?? null;
  const endPoint = selected?.points[selected.points.length - 1] ?? null;

  const totalDuration = flights.reduce((sum, flight) => sum + flight.duration_s, 0);
  const totalDistance = flights.reduce((sum, flight) => sum + flight.distance_km, 0);
  const totalSeeds = flights.reduce((sum, flight) => sum + (flight.seeds_dropped ?? 0), 0);

  const removeAll = () => {
    if (flights.length === 0) return;
    if (window.confirm("Hapus semua riwayat penerbangan yang tersimpan di browser ini?")) {
      clear();
      setSelectedId(null);
    }
  };

  return (
    <div className="page-fit">
      <PageHeader
        className="feature-page-head"
        eyebrow="Analitik penerbangan"
        title="Riwayat penerbangan"
        description="Arsip sesi terbang yang tersimpan di browser. Lihat durasi, jarak, benih yang sudah ditebar, lalu pilih sesi untuk membaca profil jalur dan koordinatnya."
        detail={{ label: "Detail riwayat penerbangan", to: "/detail/penerbangan" }}
        meta={
          <div className="page-stats" aria-label="Ringkasan riwayat">
            <span>
              Sesi <b>{flights.length}</b>
            </span>
            <span>
              Total terbang <b>{fmtDuration(totalDuration)}</b>
            </span>
            <span>
              Total jarak <b>{fmtNumber(totalDistance, 2)} km</b>
            </span>
            <span>
              Benih ditebar <b>{fmtInt(totalSeeds)}</b>
            </span>
          </div>
        }
        source="localStorage browser"
        legend={[
          { label: "Sesi", tone: "info" },
          { label: "Jarak", tone: "route" },
          { label: "Benih", tone: "drop" },
        ]}
        actions={
          <button type="button" className="btn btn-danger btn-sm" onClick={removeAll} disabled={flights.length === 0}>
            Hapus riwayat
          </button>
        }
      />

      <LiveDroneStrip />

      <div className="fit-2col fit-flight-grid">
        <Card title="Sesi penerbangan" meta={`${flights.length} sesi`} className="fit-card">
          {flights.length === 0 ? (
            <div className="empty">
              Belum ada sesi. Riwayat akan tercatat otomatis saat drone armed dan telemetri GPS masuk.
            </div>
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
                        <td className="num">{flight.avg_speed === null ? "-" : `${fmtNumber(flight.avg_speed, 1)} m/s`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Detail penerbangan" meta={selected ? (selected.id === active?.id ? "Sedang berlangsung" : "Selesai") : undefined} className="fit-card">
          {!selected ? (
            <div className="empty">Pilih sesi untuk melihat detail.</div>
          ) : (
            <div className="flight-detail">
              <div className="grid grid-2" style={{ gap: "var(--space-3)" }}>
                <div className="metric">
                  <span className="metric-label">Mulai</span>
                  <span className="metric-value small">{fmtDateTime(selected.startedAt / 1000)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Durasi</span>
                  <span className="metric-value small">{fmtDuration(selected.duration_s)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Jarak terbang</span>
                  <span className="metric-value small">{fmtNumber(selected.distance_km, 2)} km</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Benih sudah ditebar</span>
                  <span className="metric-value small">{fmtInt(selected.seeds_dropped)}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Sisa benih</span>
                  <span className="metric-value small">
                    {selected.seeds_start === null ? "-" : `${fmtInt(selected.seeds_start)} → ${fmtInt(selected.seeds_end)}`}
                  </span>
                </div>
                <div className="metric">
                  <span className="metric-label">Titik sampel</span>
                  <span className="metric-value small">{selected.points.length}</span>
                </div>
              </div>

              <div className="flight-coords">
                <span>Awal: {fmtCoord(startPoint?.lat ?? null, startPoint?.lon ?? null)}</span>
                <span>Akhir: {fmtCoord(endPoint?.lat ?? null, endPoint?.lon ?? null)}</span>
              </div>

              <div className="fit-2col" style={{ flex: "none", gap: "var(--space-4)" }}>
                <LineChart
                  series={[{ label: "Ketinggian", color: "var(--primary)", values: selected.points.map((point) => point.alt) }]}
                  labels={labels}
                  height={110}
                  format={(value) => `${value.toFixed(0)} m`}
                />
                <LineChart
                  series={[{ label: "Kecepatan", color: "var(--warn)", values: selected.points.map((point) => point.speed) }]}
                  labels={labels}
                  height={110}
                  format={(value) => `${value.toFixed(1)} m/s`}
                />
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
