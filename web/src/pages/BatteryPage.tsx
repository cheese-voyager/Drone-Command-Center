import { Card } from "../components/ui/Card";
import { useDroneStore } from "../store/droneStore";
import { BatteryGauge } from "../components/telemetry/BatteryGauge";
import { BatteryForm } from "../components/battery/BatteryForm";
import { FlightTimeEstimate } from "../components/telemetry/FlightTimeEstimate";
import { VoltageCurrentCard } from "../components/telemetry/VoltageCurrentCard";
import { LineChart } from "../components/charts/LineChart";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";
import { exportBatteryExcel, exportBatteryPdf } from "../utils/reports";
import { fmtMinutes, fmtNumber } from "../utils/format";

export function BatteryPage() {
  const drone = useDroneStore((state) => state.status);
  const history = useDroneStore((state) => state.history);
  const battery = drone?.battery;
  const minutesLeft = battery?.estimated_minutes_left ?? null;
  const labels = history.map((sample) => new Date(sample.time).toLocaleTimeString("id-ID", { hour12: false }));

  return (
    <div className="page-fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Baterai</h1>
          <p className="page-sub">Status baterai, konsumsi daya, dan konfigurasi kapasitas.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => exportBatteryPdf(history, battery)} disabled={history.length === 0}>
            Unduh PDF
          </button>
          <button className="btn btn-secondary" onClick={() => exportBatteryExcel(history, battery)} disabled={history.length === 0}>
            Unduh Excel
          </button>
        </div>
      </div>

      <LiveDroneStrip />

      <div className="fit-3col">
        <Card title="Status baterai" meta={battery?.low ? "BATERAI RENDAH" : "Normal"} className="fit-card">
          <div className="flex center" style={{ gap: "var(--space-4)" }}>
            <BatteryGauge percent={battery?.remaining_percent ?? 0} size={132} />
            <div className="flex" style={{ flexDirection: "column", gap: "10px", minWidth: 0 }}>
              <div className="metric">
                <span className="metric-label">Sisa</span>
                <span className="metric-value small">{fmtNumber(battery?.remaining_percent ?? null, 0)} %</span>
              </div>
              <div className="metric">
                <span className="metric-label">Estimasi terbang</span>
                <span className="metric-value small">{fmtMinutes(minutesLeft)}</span>
              </div>
            </div>
          </div>
          <dl className="kv" style={{ marginTop: "var(--space-3)" }}>
            <dt>Kapasitas</dt>
            <dd>{fmtNumber(battery?.capacity_mah, 0)} mAh</dd>
            <dt>Terpakai</dt>
            <dd>{fmtNumber(battery?.used_mah)} mAh</dd>
            <dt>Sisa</dt>
            <dd>{fmtNumber(battery?.remaining_mah)} mAh</dd>
            </dl>
        </Card>
        <BatteryForm />
        <div className="fit-col">
          <VoltageCurrentCard voltage={drone?.voltage ?? null} current={drone?.current ?? null} avgCurrent={battery?.avg_current ?? null} />
          <FlightTimeEstimate minutes={minutesLeft} />
        </div>
      </div>

      <Card title="Riwayat daya" meta={`${history.length} sampel`} className="fit-card" style={{ flex: "0 0 196px" }}>
        <div className="fit-3col" style={{ flex: "none" }}>
          <LineChart
            series={[{ label: "Baterai", color: "var(--primary)", values: history.map((sample) => sample.battery) }]}
            labels={labels}
            height={116}
            format={(value) => `${value.toFixed(0)}%`}
          />
          <LineChart
            series={[{ label: "Tegangan", color: "var(--ok)", values: history.map((sample) => sample.voltage) }]}
            labels={labels}
            height={116}
            format={(value) => `${value.toFixed(1)} V`}
          />
          <LineChart
            series={[{ label: "Arus", color: "var(--warn)", values: history.map((sample) => sample.current) }]}
            labels={labels}
            height={116}
            format={(value) => `${value.toFixed(1)} A`}
          />
        </div>
      </Card>
    </div>
  );
}
