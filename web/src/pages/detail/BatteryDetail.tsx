import { useMemo } from "react";
import { Card } from "../../components/ui/Card";
import { BatteryGauge } from "../../components/telemetry/BatteryGauge";
import { LineChart } from "../../components/charts/LineChart";
import { DetailBar, DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useDroneStore } from "../../store/droneStore";
import { fmtMinutes, fmtNumber, fmtPercent } from "../../utils/format";

export function BatteryDetailPage() {
  const status = useDroneStore((state) => state.status);
  const history = useDroneStore((state) => state.history);
  const battery = status?.battery ?? null;

  const labels = useMemo(
    () => history.map((sample) => new Date(sample.time).toLocaleTimeString("id-ID", { hour12: false })),
    [history],
  );
  const recent = useMemo(() => history.slice(-20).reverse(), [history]);

  return (
    <div className="detail-page">
      <Card title="Baterai saat ini" meta="MQTT /status">
        {!battery ? (
          <DetailEmpty>Menunggu data baterai.</DetailEmpty>
        ) : (
          <div className="fit-2col" style={{ flex: "none", gap: "var(--space-5)" }}>
            <BatteryGauge percent={battery.remaining_percent} size={220} />
            <div className="fit-col">
              <DetailMetrics
                className="grid-2"
                items={[
                  { label: "Sisa kapasitas", value: fmtPercent(battery.remaining_percent) },
                  { label: "Sisa mAh", value: Math.round(battery.remaining_mah) },
                  { label: "Terpakai", value: Math.round(battery.used_mah) },
                  { label: "Kapasitas", value: Math.round(battery.capacity_mah) },
                  { label: "Arus rata-rata", value: `${fmtNumber(battery.avg_current)} A` },
                  { label: "Estimasi tersisa", value: fmtMinutes(battery.estimated_minutes_left) },
                  { label: "Tegangan", value: `${fmtNumber(status?.voltage ?? null, 1)} V` },
                  { label: "Arus", value: `${fmtNumber(status?.current ?? null)} A` },
                ]}
              />
              <DetailBar
                value={battery.remaining_percent}
                tone={battery.low ? "error" : battery.remaining_percent < 50 ? "warn" : "ok"}
              />
              {battery.low ? <p className="banner banner-error">Baterai memasuki kondisi low.</p> : null}
            </div>
          </div>
        )}
      </Card>

      <Card title="Konfigurasi paket" meta="Belum tersedia dari endpoint">
        <DetailMetrics
          items={[
            { label: "Kapasitas nominal", value: battery ? Math.round(battery.capacity_mah) : "-" },
            { label: "Jumlah sel", value: "-" },
            { label: "Persentase minimum aman", value: "-" },
            { label: "Tegangan per sel", value: "-" },
          ]}
        />
      </Card>

      <Card title="Riwayat daya" meta="Sampel telemetri browser">
        <div className="fit-2col" style={{ flex: "none", gap: "var(--space-4)" }}>
          <LineChart
            series={[{ label: "Baterai", color: "var(--primary)", values: history.map((sample) => sample.battery) }]}
            labels={labels}
            height={140}
            format={(value) => `${value.toFixed(0)}%`}
          />
          <LineChart
            series={[{ label: "Tegangan", color: "var(--ok)", values: history.map((sample) => sample.voltage) }]}
            labels={labels}
            height={140}
            format={(value) => `${value.toFixed(1)} V`}
          />
          <LineChart
            series={[{ label: "Arus", color: "var(--warn)", values: history.map((sample) => sample.current) }]}
            labels={labels}
            height={140}
            format={(value) => `${value.toFixed(1)} A`}
          />
        </div>
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
                  <th>Baterai</th>
                  <th>Tegangan</th>
                  <th>Arus</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((sample) => (
                  <tr key={sample.time}>
                    <td className="num">{new Date(sample.time).toLocaleTimeString("id-ID", { hour12: false })}</td>
                    <td className="num">{fmtPercent(sample.battery)}</td>
                    <td className="num">{fmtNumber(sample.voltage, 1)} V</td>
                    <td className="num">{fmtNumber(sample.current)} A</td>
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
