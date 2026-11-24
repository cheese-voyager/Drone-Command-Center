import { Card } from "../../components/ui/Card";
import { DropHistoryPanel } from "../../components/drop/DropHistoryPanel";
import { DetailBar, DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useDroneStore } from "../../store/droneStore";
import { useDropHistory } from "../../hooks/useDropHistory";
import { fmtCoord, fmtDateTime, fmtNumber } from "../../utils/format";

export function DropDetailPage() {
  const status = useDroneStore((state) => state.status);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const drops = useDropHistory(lastDrop);
  const seed = status?.seed ?? null;

  return (
    <div className="detail-page">
      <Card title="Kondisi drop" meta="MQTT /status">
        <DetailMetrics
          items={[
            { label: "Total drop tersimpan", value: drops.length },
            { label: "Benih tersisa", value: seed ? seed.remaining : "-" },
            { label: "Benih sudah ditebar", value: seed ? seed.dropped : "-" },
            { label: "Drop terakhir", value: lastDrop ? fmtDateTime(lastDrop.time) : "-" },
          ]}
        />
        {seed ? (
          <div style={{ marginTop: "var(--space-3)" }}>
            <DetailBar
              value={seed.loaded > 0 ? (seed.remaining / seed.loaded) * 100 : 0}
              tone={seed.remaining === 0 ? "error" : ""}
            />
          </div>
        ) : null}
      </Card>

      <Card title="Konfigurasi drop aktif" meta="Belum tersedia dari endpoint">
        <DetailMetrics
          items={[
            { label: "Thrust", value: "-" },
            { label: "Durasi", value: "-" },
            { label: "Channel servo", value: "-" },
            { label: "PWM minimum", value: "-" },
            { label: "PWM maksimum", value: "-" },
            { label: "Benih per drop", value: "-" },
          ]}
        />
      </Card>

      {lastDrop ? (
        <Card title="Drop event terakhir" meta="MQTT /drop_event">
          <DetailMetrics
            items={[
              { label: "Waktu", value: fmtDateTime(lastDrop.time) },
              { label: "Koordinat", value: fmtCoord(lastDrop.lat, lastDrop.lon) },
              { label: "Thrust", value: `${fmtNumber(lastDrop.thrust, 0)}%` },
              { label: "Durasi", value: `${fmtNumber(lastDrop.duration, 1)} s` },
            ]}
          />
        </Card>
      ) : null}

      <DropHistoryPanel drops={drops} />

      <Card title="Riwayat drop lengkap" meta={`${drops.length} catatan`}>
        {drops.length === 0 ? (
          <DetailEmpty>Belum ada riwayat drop.</DetailEmpty>
        ) : (
          <div className="scroll-y">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Thrust</th>
                  <th>Durasi</th>
                </tr>
              </thead>
              <tbody>
                {drops
                  .slice()
                  .reverse()
                  .map((drop) => (
                    <tr key={`${drop.time}-${drop.lat}-${drop.lon}`}>
                      <td className="num">{fmtDateTime(drop.time)}</td>
                      <td className="num">{drop.lat === null ? "-" : drop.lat.toFixed(6)}</td>
                      <td className="num">{drop.lon === null ? "-" : drop.lon.toFixed(6)}</td>
                      <td className="num">{fmtNumber(drop.thrust, 0)}%</td>
                      <td className="num">{fmtNumber(drop.duration, 1)} s</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
