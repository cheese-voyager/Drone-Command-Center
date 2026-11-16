import { useState } from "react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useDroneStore } from "../../store/droneStore";
import { CommandError } from "../../api/droneMqtt";
import type { SeedConfig } from "../../types";

export function SeedLoadForm() {
  const [loaded, setLoaded] = useState("200");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const send = useDroneStore((state) => state.send);
  const { push } = useToast();

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await send<SeedConfig>("seed-load", { loaded: Number(loaded) });
      push("Benih dimuat.", "ok");
    } catch (e) {
      const commandError = e as CommandError;
      setError(commandError.code ?? "seed_load_failed");
      push(`Gagal memuat benih: ${commandError.code ?? ""}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="section-title">Muat Benih</div>
      <label className="label" htmlFor="seed-loaded">Jumlah benih dimuat</label>
      <input
        id="seed-loaded"
        className="input"
        type="number"
        min={0}
        value={loaded}
        onChange={(e) => setLoaded(e.target.value)}
      />
      {error ? <span className="field-error" style={{ marginBottom: "var(--space-3)" }}>{error}</span> : null}
      <Button variant="primary" onClick={() => void save()} loading={busy}>
        Muat Benih
      </Button>
    </div>
  );
}
