import { useState } from "react";
import { useDroneStore } from "../../store/droneStore";
import { useToast } from "../ui/Toast";
import type { ThrusterStopResponse } from "../../types";

export function EmergencyStopButton() {
  const send = useDroneStore((state) => state.send);
  const [busy, setBusy] = useState(false);
  const { push } = useToast();

  const run = async () => {
    setBusy(true);
    try {
      const result = await send<ThrusterStopResponse>("thruster-stop");
      if (!result.stopped) {
        push("Stop darurat tidak berhasil terkirim. Putuskan daya secara manual!", "error");
      } else {
        push("Thruster berhasil dihentikan.", "ok");
      }
    } catch {
      push("Stop darurat gagal: putuskan daya secara manual!", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn btn-danger" onClick={() => void run()} disabled={busy}>
      Stop darurat
    </button>
  );
}
