import { useDroneStore } from "../store/droneStore";
import { Card } from "../components/ui/Card";
import { EmergencyStopButton } from "../components/thruster/EmergencyStopButton";
import { ThrusterTestForm } from "../components/thruster/ThrusterTestForm";
import { MOTOR_TEST_MAX_PERCENT } from "../utils/constants";

export function ThrusterTestPage() {
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const error = useDroneStore((state) => state.error);
  const armed = useDroneStore((state) => state.status?.armed ?? false);

  return (
    <div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Tes tidak dapat dikirim.</div> : null}
      <div className="page-head">
        <div>
          <h1 className="page-title">Tes thruster &amp; motor</h1>
          <p className="page-sub">Tes thruster penebar benih atau motor penggerak.</p>
        </div>
        <span className={`badge ${armed ? "badge-error" : "badge-ok"}`}>{armed ? "ARMED · tes motor ditolak" : "DISARMED"}</span>
      </div>
      <div className="banner banner-warning" role="note">
        <div>
          <strong>Peringatan keselamatan.</strong> Lepas baling-baling sebelum tes motor. Tes motor hanya saat drone disarm dan thrust maksimal {MOTOR_TEST_MAX_PERCENT}%.
        </div>
      </div>
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <ThrusterTestForm />
        <div className="stack">
          <Card title="Motor penggerak" meta="Output saat ini">
            <MotorList />
          </Card>
          <Card className="card-danger" title="Stop darurat">
            <div className="stack">
              <EmergencyStopButton />
              <p className="hint">Menghentikan thruster segera. Tidak memakai dialog konfirmasi.</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MotorList() {
  const status = useDroneStore((state) => state.status);
  const motors = status?.motors;
  if (!motors) {
    return <p className="muted">Belum ada data motor.</p>;
  }
  return (
    <>
      {motors.map((m) => (
        <div key={m.id} className="motor-row">
          <span>M{m.id}</span>
          <div className={`bar${m.percent < 30 ? " warn" : ""}`}>
            <span style={{ width: `${Math.max(0, Math.min(100, m.percent))}%` }} />
          </div>
          <span>{m.percent.toFixed(1)}%</span>
        </div>
      ))}
    </>
  );
}
