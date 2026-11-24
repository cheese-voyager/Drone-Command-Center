import { Card } from "../../components/ui/Card";
import { DetailBar, DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useDroneStore } from "../../store/droneStore";
import { MOTOR_TEST_MAX_PERCENT } from "../../utils/constants";
import { fmtNumber } from "../../utils/format";

export function ThrusterDetailPage() {
  const status = useDroneStore((state) => state.status);
  const motors = status?.motors ?? [];

  return (
    <div className="detail-page">
      <Card title="Status pengaman" meta="MQTT /status">
        <DetailMetrics
          items={[
            { label: "Drone", value: status?.connected ? "TERHUBUNG" : "TERPUTUS" },
            { label: "Armed", value: status ? (status.armed ? "YA" : "TIDAK") : "-" },
            {
              label: "Tes motor",
              value: status?.armed ? "DITOLAK" : "DIIZINKAN",
              sub: `Batas uji ${MOTOR_TEST_MAX_PERCENT}%`,
            },
            { label: "Mode", value: status?.mode ?? "-" },
          ]}
        />
      </Card>

      <Card title="Output motor" meta={`${motors.length} motor terdeteksi`}>
        {motors.length === 0 ? (
          <DetailEmpty>Belum ada data motor dari Mission Planner.</DetailEmpty>
        ) : (
          <div className="motor-grid">
            {motors.map((motor) => (
              <div className="motor-mini" key={motor.id}>
                <span>M{motor.id}</span>
                <DetailBar value={motor.percent} tone={motor.percent > MOTOR_TEST_MAX_PERCENT ? "warn" : "ok"} />
                <span className="m-pct">{fmtNumber(motor.percent, 0)}%</span>
                <span className="metric-sub">PWM {Math.round(motor.pwm)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Konfigurasi servo" meta="Belum tersedia dari endpoint">
        <DetailMetrics
          items={[
            { label: "Channel servo", value: "-" },
            { label: "PWM minimum", value: "-" },
            { label: "PWM maksimum", value: "-" },
            { label: "Thrust default", value: "-" },
            { label: "Durasi default", value: "-" },
            { label: "Target terakhir", value: "-" },
          ]}
        />
      </Card>

      <Card title="Riwayat perintah tes" meta="Tidak disimpan di backend">
        <DetailEmpty>Backend belum menyimpan riwayat perintah thruster test.</DetailEmpty>
      </Card>
    </div>
  );
}
