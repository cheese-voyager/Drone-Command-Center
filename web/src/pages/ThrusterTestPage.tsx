import { useDroneStore } from "../store/droneStore";
import { EmergencyStopButton } from "../components/thruster/EmergencyStopButton";
import { ThrusterTestForm } from "../components/thruster/ThrusterTestForm";

export function ThrusterTestPage() {
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const error = useDroneStore((state) => state.error);

  return (
    <div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Tes tidak dapat dikirim.</div> : null}
      <div className="page-head">
        <div>
          <h1 className="page-title">Tes Thruster</h1>
          <p className="page-sub">Tes thruster penebar benih atau motor penggerak.</p>
        </div>
        <EmergencyStopButton />
      </div>
      <div className="grid grid-2">
        <ThrusterTestForm />
        <div className="card card-pad">
          <div className="section-title">Motor Penggerak</div>
          <MotorList />
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
          <span>Motor {m.id}</span>
          <div className={`bar${m.percent < 30 ? " warn" : ""}`}>
            <span style={{ width: `${Math.max(0, Math.min(100, m.percent))}%` }} />
          </div>
          <span className="mono">{m.percent.toFixed(1)}%</span>
        </div>
      ))}
    </>
  );
}
