import { Card } from "../../components/ui/Card";
import { BatteryGauge } from "../../components/telemetry/BatteryGauge";
import { ImuAttitude } from "../../components/telemetry/ImuAttitude";
import { DetailBar, DetailEmpty, DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useDroneStore } from "../../store/droneStore";
import { GPS_FIX_NAMES } from "../../utils/constants";
import { fmtCoord, fmtNumber, fmtPercent } from "../../utils/format";

export function StatusDetailPage() {
  const status = useDroneStore((state) => state.status);
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const stale = useDroneStore((state) => state.stale);
  const connecting = useDroneStore((state) => state.connecting);
  const error = useDroneStore((state) => state.error);
  const lastStatusAt = useDroneStore((state) => state.lastStatusAt);

  if (!status) {
    return (
      <div className="detail-page">
        <Card title="Payload status lengkap" meta="MQTT /status">
          <DetailEmpty>
            {error ?? (connecting ? "Menghubungkan ke backend..." : "Menunggu status pertama dari drone.")}
          </DetailEmpty>
        </Card>
      </div>
    );
  }

  const fixLabel = status.gps_fix === null ? "-" : GPS_FIX_NAMES[status.gps_fix] ?? String(status.gps_fix);
  const battery = status.battery;
  const motors = status.motors ?? [];

  return (
    <div className="detail-page">
      <Card title="Status perangkat" meta={status.connected ? "Terhubung" : "Terputus"}>
        <DetailMetrics
          items={[
            { label: "Mode", value: status.mode ?? "-" },
            { label: "Armed", value: status.armed ? "YA" : "TIDAK" },
            { label: "Backend", value: backendOnline ? "ONLINE" : "OFFLINE" },
            { label: "Data", value: stale ? "BASI" : "SEGAR" },
            { label: "Koneksi", value: connecting ? "CONNECTING" : error ? "ERROR" : "LIVE" },
            {
              label: "Status terakhir",
              value: lastStatusAt === 0 ? "-" : new Date(lastStatusAt).toLocaleTimeString("id-ID", { hour12: false }),
            },
          ]}
        />
        {error ? <p className="banner banner-error">{error}</p> : null}
      </Card>

      <Card title="Posisi dan navigasi" meta="GNSS / IMU">
        <DetailMetrics
          items={[
            { label: "Koordinat", value: fmtCoord(status.lat, status.lon) },
            { label: "Ketinggian", value: `${fmtNumber(status.alt)} m` },
            { label: "Kecepatan", value: `${fmtNumber(status.speed)} m/s` },
            { label: "Rata-rata kecepatan", value: `${fmtNumber(status.avg_speed)} m/s` },
            { label: "GPS fix", value: fixLabel },
            { label: "Satelit", value: status.satellites === null ? "-" : Math.round(status.satellites) },
            { label: "Yaw", value: `${fmtNumber(status.yaw, 0)}°` },
            { label: "Phase", value: status.gps_fix === null ? "-" : `${status.gps_fix}` },
          ]}
        />
      </Card>

      <ImuAttitude pitch={status.pitch} roll={status.roll} yaw={status.yaw} />

      <Card title="Daya" meta="Baterai">
        <div className="fit-2col" style={{ flex: "none", gap: "var(--space-5)" }}>
          <BatteryGauge percent={battery.remaining_percent} size={180} />
          <DetailMetrics
            className="grid-2"
            items={[
              { label: "Sisa", value: fmtPercent(battery.remaining_percent) },
              { label: "Tegangan", value: `${fmtNumber(status.voltage, 1)} V` },
              { label: "Arus", value: `${fmtNumber(status.current)} A` },
              { label: "Arus rata-rata", value: `${fmtNumber(battery.avg_current)} A` },
            ]}
          />
        </div>
      </Card>

      <Card title="Output motor" meta={`${motors.length} motor`}>
        {motors.length === 0 ? (
          <DetailEmpty>Belum ada data motor.</DetailEmpty>
        ) : (
          <div className="motor-grid">
            {motors.map((motor) => (
              <div className="motor-mini" key={motor.id}>
                <span>M{motor.id}</span>
                <DetailBar value={motor.percent} tone={motor.percent < 30 ? "warn" : ""} />
                <span className="m-pct">{fmtNumber(motor.percent, 0)}%</span>
                <span className="metric-sub">PWM {Math.round(motor.pwm)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Payload status mentah" meta="Payload apa adanya">
        <pre className="mp-raw">{JSON.stringify(status, null, 2)}</pre>
      </Card>
    </div>
  );
}
