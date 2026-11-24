import { useState } from "react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useDroneStore } from "../../store/droneStore";
import { CommandError } from "../../api/droneMqtt";
import { useBackendUrl } from "../../hooks/useBackendUrl";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { DropRecord } from "../../types";

export function DropButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = useDroneStore((state) => state.send);
  const { push } = useToast();
  const url = useBackendUrl();

  const drop = async () => {
    setBusy(true);
    try {
      const result = await send<DropRecord>("drop");
      push("Drop berhasil dicatat.", "ok");
      void result;
      void url;
      setConfirming(false);
    } catch (e) {
      const commandError = e as CommandError;
      push(`Drop gagal: ${commandError.code ?? ""}`, "error");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="danger" onClick={() => setConfirming(true)} disabled={busy}>
        Drop sekarang
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Konfirmasi drop"
        message="Lepas semua kabel dan pastikan area drop aman. Drop akan mengurangi jumlah benih dan dicatat di riwayat."
        confirmLabel="Jalankan drop"
        busy={busy}
        onConfirm={() => void drop()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
