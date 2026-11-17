import { Card } from "../components/ui/Card";
import { useDroneStore } from "../store/droneStore";
import { BatteryGauge } from "../components/telemetry/BatteryGauge";
import { BatteryForm } from "../components/battery/BatteryForm";
import { FlightTimeEstimate } from "../components/telemetry/FlightTimeEstimate";
import { VoltageCurrentCard } from "../components/telemetry/VoltageCurrentCard";
import { fmtNumber } from "../utils/format";

export function BatteryPage() {
  const status = useDroneStore((state) => state.status);
  const drone = status;
  const battery = drone?.battery;
  const minutesLeft = battery?.estimated_minutes_left ?? null;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Baterai</h1>
          <p className="page-sub">Status baterai dan konfigurasi kapasitas.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <Card title="Status baterai" meta={battery?.low ? "BATERAI RENDAH" : "Normal"}>
          <BatteryGauge percent={battery?.remaining_percent ?? 0} size={160} />
          <dl className="kv" style={{ marginTop: "var(--space-4)" }}>
            <dt>Kapasitas</dt>
            <dd>{fmtNumber(battery?.capacity_mah, 0)} mAh</dd>
            <dt>Terpakai</dt>
            <dd>{fmtNumber(battery?.used_mah)} mAh</dd>
            <dt>Sisa</dt>
            <dd>{fmtNumber(battery?.remaining_mah)} mAh</dd>
            <dt>Estimasi Sisa Waktu</dt>
            <dd>{minutesLeft === null ? "-" : `${minutesLeft.toFixed(1)} mnt`}</dd>
          </dl>
        </Card>
        <div className="grid" style={{ alignContent: "start" }}>
          <BatteryForm />
          <VoltageCurrentCard voltage={drone?.voltage ?? null} current={drone?.current ?? null} avgCurrent={battery?.avg_current ?? null} />
          <FlightTimeEstimate minutes={minutesLeft} />
        </div>
      </div>
    </div>
  );
}
