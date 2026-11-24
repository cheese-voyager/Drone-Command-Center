import { useDroneStore } from "../store/droneStore";
import { Card } from "../components/ui/Card";
import { EmergencyStopButton } from "../components/thruster/EmergencyStopButton";
import { ThrusterTestForm } from "../components/thruster/ThrusterTestForm";
import { BarChart } from "../components/charts/BarChart";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";
import { MOTOR_TEST_MAX_PERCENT } from "../utils/constants";
import { PageHeader } from "../components/layout/PageHeader";

export function ThrusterTestPage() {
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const error = useDroneStore((state) => state.error);
  const armed = useDroneStore((state) => state.status?.armed ?? false);
  const motorCount = useDroneStore((state) => state.status?.motors?.length ?? 0);

  return (
    <div className="page-fit">
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Tes tidak dapat dikirim.</div> : null}
      <PageHeader
        className="feature-page-head"
        eyebrow="Pemeliharaan aktuator"
        title="Tes thruster dan motor"
        description="Uji thruster penebar benih atau motor penggerak dengan batas daya aman. Tes motor hanya diperbolehkan saat drone dalam kondisi disarmed."
        detail={{ label: "Detail thruster dan motor", to: "/detail/thruster" }}
        meta={
          <div className="page-stats" aria-label="Ringkasan pengaman">
            <span>
              Pengaman <b>{armed ? "Armed" : "Disarmed"}</b>
            </span>
            <span>
              Motor terdeteksi <b>{motorCount}</b>
            </span>
            <span>
              Batas thrust <b>{MOTOR_TEST_MAX_PERCENT}%</b>
            </span>
            <span>
              Backend <b>{backendOnline ? "Online" : "Offline"}</b>
            </span>
          </div>
        }
        source="MQTT status"
        legend={[
          { label: "Aman", tone: "ok" },
          { label: "Tes dilarang", tone: "error" },
          { label: "Output motor", tone: "info" },
        ]}
      />

      <LiveDroneStrip />

      <div className="banner banner-warning" role="note">
        <div>
          <strong>Peringatan keselamatan.</strong> Lepas baling-baling sebelum tes motor. Tes motor hanya saat drone disarm dan thrust maksimal {MOTOR_TEST_MAX_PERCENT}%.
        </div>
      </div>

      <div className="fit-2col">
        <div className="fit-col">
          <ThrusterTestForm />
          <Card title="Urutan aman" meta="Sebelum tes" className="fit-card grow">
            <div className="check-row compact">
              <span className="mark ok" aria-hidden>1</span>
              <div className="grow">
                Pastikan drone disarmed<small>Status pengaman di atas harus Disarmed.</small>
              </div>
            </div>
            <div className="check-row compact">
              <span className="mark ok" aria-hidden>2</span>
              <div className="grow">
                Lepas baling-baling<small>Wajib untuk tes motor penggerak.</small>
              </div>
            </div>
            <div className="check-row compact">
              <span className="mark ok" aria-hidden>3</span>
              <div className="grow">
                Mulai dari thrust rendah<small>Motor maksimal {MOTOR_TEST_MAX_PERCENT}%.</small>
              </div>
            </div>
          </Card>
        </div>
        <div className="fit-col">
          <Card title="Motor penggerak" meta="Output saat ini" className="fit-card">
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
      <BarChart
        data={motors.map((motor) => ({
          label: `M${motor.id}`,
          value: motor.percent,
          color: motor.percent < 30 ? "var(--warn)" : "var(--primary)",
        }))}
        height={96}
        format={(value) => `${value.toFixed(0)}%`}
      />
      <div style={{ marginTop: "var(--space-3)" }}>
        {motors.map((m) => (
          <div key={m.id} className="motor-row with-pwm">
            <span>M{m.id}</span>
            <div className={`bar${m.percent < 30 ? " warn" : ""}`}>
              <span style={{ width: `${Math.max(0, Math.min(100, m.percent))}%` }} />
            </div>
            <span>{m.percent.toFixed(1)}%</span>
            <span className="muted">PWM {m.pwm}</span>
          </div>
        ))}
      </div>
    </>
  );
}
