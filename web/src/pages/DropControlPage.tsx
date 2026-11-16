import { useDroneStore } from "../store/droneStore";
import { DropButton } from "../components/drop/DropButton";
import { DropConfigForm } from "../components/drop/DropConfigForm";
import { SeedCounter } from "../components/seed/SeedCounter";

export function DropControlPage() {
  const backendOnline = useDroneStore((state) => state.backendOnline);
  const error = useDroneStore((state) => state.error);

  return (
    <div>
      {error ? <div className="banner banner-error">{error}</div> : null}
      {!backendOnline ? <div className="banner banner-warning">Backend offline. Drop tidak dapat dikirim.</div> : null}
      <div className="page-head">
        <div>
          <h1 className="page-title">Drop Benih</h1>
          <p className="page-sub">Atur thrust dan durasi, lalu lakukan drop.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <DropConfigForm />
        <div>
          <SeedCounter />
          <div className="card card-pad" style={{ marginTop: "var(--space-4)" }}>
            <div className="section-title">Aksi</div>
            <DropButton />
          </div>
        </div>
      </div>
    </div>
  );
}
