import { useDroneStore } from "../store/droneStore";
import { useDropHistory } from "../hooks/useDropHistory";
import { Card } from "../components/ui/Card";
import { DropButton } from "../components/drop/DropButton";
import { DropConfigForm } from "../components/drop/DropConfigForm";
import { DropHistoryTable } from "../components/drop/DropHistoryTable";
import { SeedCounter } from "../components/seed/SeedCounter";

interface Check {
  label: string;
  detail: string;
  ok: boolean;
}

export function DropControlPage() {
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const error = useDroneStore((state) => state.error);
  const status = useDroneStore((state) => state.status);
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const drops = useDropHistory(lastDrop);

  const remaining = status?.seed?.remaining ?? null;
  const battery = status?.battery;
  const checks: Check[] = [
    { label: "Pixhawk terhubung", detail: status?.connected ? "Data MAVLink masuk" : "Belum ada data MAVLink", ok: status?.connected ?? false },
    { label: "GPS 3D fix", detail: status?.satellites != null ? `${Math.round(status.satellites)} satelit` : "Belum ada data GPS", ok: (status?.gps_fix ?? 0) >= 3 },
    { label: "Benih tersedia", detail: remaining !== null ? `${remaining} tersisa` : "Belum ada data benih", ok: (remaining ?? 0) > 0 },
    { label: "Baterai di atas batas aman", detail: battery ? `${battery.remaining_percent.toFixed(0)}% tersisa` : "Belum ada data baterai", ok: battery ? !battery.low : false },
  ];
  const readyCount = checks.filter((c) => c.ok).length;

  return (
    <div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Drop tidak dapat dikirim.</div> : null}
      <div className="page-head">
        <div>
          <h1 className="page-title">Drop benih</h1>
          <p className="page-sub">Atur thrust dan durasi, periksa kesiapan, lalu lakukan drop.</p>
        </div>
      </div>
      <div className="grid grid-2" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", alignItems: "start" }}>
        <div className="stack">
          <DropConfigForm />
          <Card title="Kesiapan" meta={`${readyCount} / ${checks.length} siap`}>
            {checks.map((c) => (
              <div key={c.label} className="check-row">
                <span className={`mark ${c.ok ? "ok" : "warn"}`} aria-hidden>
                  {c.ok ? "✓" : "!"}
                </span>
                <div className="grow">
                  {c.label}
                  <small>{c.detail}</small>
                </div>
                <span className={`badge ${c.ok ? "badge-ok" : "badge-warn"}`}>{c.ok ? "OK" : "Cek"}</span>
              </div>
            ))}
            <p className="hint" style={{ marginTop: "var(--space-3)" }}>
              Ringkasan dari data telemetri. Backend tetap menolak drop jika kondisinya tidak aman.
            </p>
          </Card>
        </div>
        <div className="stack">
          <SeedCounter />
          <Card title="Eksekusi drop">
            <DropButton />
          </Card>
          <Card title="Riwayat drop" meta={`${drops.length} total`}>
            <div className="scroll-y">
              <DropHistoryTable drops={drops} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
