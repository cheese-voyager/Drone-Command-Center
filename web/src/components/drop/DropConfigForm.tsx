import { useState } from "react";
import { Button } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { useToast } from "../ui/Toast";
import { useDroneStore } from "../../store/droneStore";
import { CommandError } from "../../api/droneMqtt";
import { useBackendUrl } from "../../hooks/useBackendUrl";
import type { DropConfig } from "../../types";

export function DropConfigForm() {
  const [thrustPercent, setThrustPercent] = useState("70");
  const [durationS, setDurationS] = useState("1.5");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const send = useDroneStore((state) => state.send);
  const { push } = useToast();
  const url = useBackendUrl();

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await send<DropConfig>("drop-config", {
        thrust_percent: Number(thrustPercent),
        duration_s: Number(durationS),
      });
      push("Pengaturan drop disimpan.", "ok");
      void result;
      void url;
    } catch (e) {
      const commandError = e as CommandError;
      setError(commandError.code ?? "drop_config_failed");
      push(`Gagal menyimpan pengaturan drop: ${commandError.code ?? ""}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="section-title">Pengaturan Drop</div>
      <Slider
        label="Thrust (%)"
        min={0}
        max={100}
        step={1}
        value={Number(thrustPercent)}
        valueLabel={`${thrustPercent}%`}
        onChange={(e) => setThrustPercent(e.target.value)}
      />
      <Slider
        label="Durasi (detik)"
        min={0.1}
        max={10}
        step={0.1}
        value={Number(durationS)}
        valueLabel={`${durationS}s`}
        onChange={(e) => setDurationS(e.target.value)}
      />
      {error ? <span className="field-error" style={{ marginBottom: "var(--space-3)" }}>{error}</span> : null}
      <Button variant="primary" onClick={() => void save()} loading={busy}>
        Simpan Pengaturan Drop
      </Button>
    </div>
  );
}
