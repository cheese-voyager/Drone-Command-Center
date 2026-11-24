import { useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { LineChart } from "../../components/charts/LineChart";
import { DetailBar, DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useDroneStore } from "../../store/droneStore";
import { useDropHistory } from "../../hooks/useDropHistory";
import { fmtInt } from "../../utils/format";

export function SeedDetailPage() {
  const status = useDroneStore((state) => state.status);
  const history = useDroneStore((state) => state.history);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const drops = useDropHistory(lastDrop);
  const seed = status?.seed ?? null;

  const labels = useMemo(
    () => history.map((sample) => new Date(sample.time).toLocaleTimeString("id-ID", { hour12: false })),
    [history],
  );
  const recent = useMemo(() => history.slice(-20).reverse(), [history]);

  return (
    <div className="detail-page">
      <Card title="Benih saat ini" meta="MQTT /status">
        {!seed ? (
          <DetailEmpty>Menunggu data benih.</DetailEmpty>
        ) : (
          <div className="fit-col">
            <DetailMetrics
              items={[
                { label: "Dimuat", value: fmtInt(seed.loaded) },
                { label: "Sudah ditebar", value: fmtInt(seed.dropped) },
                { label: "Tersisa", value: fmtInt(seed.remaining) },
                { label: "Drop tercatat", value: drops.length },
              ]}
            />
            <DetailBar
              value={seed.loaded > 0 ? (seed.remaining / seed.loaded) * 100 : 0}
              tone={seed.remaining === 0 ? "error" : "ok"}
            />
          </div>
        )}
      </Card>

      <Card title="Konfigurasi benih" meta="Belum tersedia dari endpoint">
        <DetailMetrics
          items={[
            { label: "Benih per drop", value: "-" },
            { label: "Kapasitas hopper", value: seed ? fmtInt(seed.loaded) : "-" },
            { label: "Jenis benih", value: "-" },
            { label: "Ukuran benih", value: "-" },
          ]}
        />
      </Card>

      <Card title="Riwayat benih" meta="Sampel telemetri browser">
        <LineChart
          series={[{ label: "Sisa benih", color: "var(--primary)", values: history.map((sample) => sample.seed_remaining) }]}
          labels={labels}
          height={180}
          format={(value) => value.toFixed(0)}
        />
      </Card>

      <Card title="Sampel terbaru" meta={`${history.length} sampel tersimpan`}>
        {recent.length === 0 ? (
          <DetailEmpty>Belum ada sampel telemetri.</DetailEmpty>
        ) : (
          <div className="scroll-y">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Sisa benih</th>
                  <th>Mode</th>
                  <th>Ketinggian</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((sample) => (
                  <tr key={sample.time}>
                    <td className="num">{new Date(sample.time).toLocaleTimeString("id-ID", { hour12: false })}</td>
                    <td className="num">{fmtInt(sample.seed_remaining)}</td>
                    <td>{sample.mode ?? "-"}</td>
                    <td className="num">{sample.alt === null ? "-" : `${sample.alt.toFixed(1)} m`}</td>
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
