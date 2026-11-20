import { useSearchParams } from "react-router-dom";
import { useDroneStore } from "../store/droneStore";
import { useDropHistory } from "../hooks/useDropHistory";
import { Card } from "../components/ui/Card";
import { DropButton } from "../components/drop/DropButton";
import { DropConfigForm } from "../components/drop/DropConfigForm";
import { DropHistoryPanel } from "../components/drop/DropHistoryPanel";
import { SeedCounter } from "../components/seed/SeedCounter";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";

interface Check {
  label: string;
  detail: string;
  ok: boolean;
}

export function DropControlPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "riwayat" ? "riwayat" : "kontrol";
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
  const latestDrop = drops.length > 0 ? drops[drops.length - 1] : null;

  const setTab = (next: "kontrol" | "riwayat") => {
    const params = new URLSearchParams(searchParams);
    if (next === "riwayat") {
      params.set("tab", "riwayat");
    } else {
      params.delete("tab");
    }
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="page-fit">
      {tab === "kontrol" && error ? <div className="banner banner-error">{error}</div> : null}
      {tab === "kontrol" && !backendOnline ? <div className="banner banner-warning">Backend offline. Drop tidak dapat dikirim.</div> : null}
      <div className="page-head">
        <div>
          <h1 className="page-title">Drop benih</h1>
          <p className="page-sub">
            {tab === "kontrol"
              ? "Atur thrust dan durasi, periksa kesiapan, lalu lakukan drop."
              : "Ringkasan, sebaran, dan seluruh titik drop yang tercatat."}
          </p>
        </div>
        <div className="page-actions">
          <div className="flex gap-1" role="tablist" aria-label="Drop benih">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "kontrol"}
              className={`btn btn-sm ${tab === "kontrol" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab("kontrol")}
            >
              Kontrol
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "riwayat"}
              className={`btn btn-sm ${tab === "riwayat" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setTab("riwayat")}
            >
              Riwayat
            </button>
          </div>
          <span className={`badge ${tab === "kontrol" && readyCount !== checks.length ? "badge-warn" : "badge-ok"}`}>
            {tab === "kontrol" ? `${readyCount} / ${checks.length} siap` : `${drops.length} titik`}
          </span>
        </div>
      </div>

      <LiveDroneStrip />

      {tab === "kontrol" ? (
        <div className="fit-2col fit-drop-grid">
          <div className="fit-col">
            <DropConfigForm />
            <Card title="Kesiapan" meta={`${readyCount} / ${checks.length} siap`} className="fit-card">
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
          <div className="fit-col">
            <SeedCounter />
            <Card title="Eksekusi drop">
              <div className="flex between center gap-3">
                <DropButton />
                <span className="hint">{remaining === null ? "Benih belum terbaca" : `${remaining} benih tersisa`}</span>
              </div>
            </Card>
            <Card title="Drop terakhir" meta={latestDrop ? `${drops.length} total` : undefined} className="fit-card grow">
              {latestDrop ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: "100%" }}>
                  <dl className="kv">
                    <dt>Waktu</dt>
                    <dd>{new Date(latestDrop.time * 1000).toLocaleTimeString("id-ID", { hour12: false })}</dd>
                    <dt>Thrust</dt>
                    <dd>{latestDrop.thrust}%</dd>
                    <dt>Durasi</dt>
                    <dd>{latestDrop.duration} s</dd>
                    <dt>Koordinat</dt>
                    <dd>
                      {latestDrop.lat === null || latestDrop.lon === null
                        ? "-"
                        : `${latestDrop.lat.toFixed(6)}, ${latestDrop.lon.toFixed(6)}`}
                    </dd>
                  </dl>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: "auto", alignSelf: "flex-start" }}
                    onClick={() => setTab("riwayat")}
                  >
                    Lihat riwayat lengkap
                  </button>
                </div>
              ) : (
                <div className="empty">Belum ada drop. Drop pertama akan muncul di sini.</div>
              )}
            </Card>
          </div>
        </div>
      ) : (
        <DropHistoryPanel drops={drops} />
      )}
    </div>
  );
}
