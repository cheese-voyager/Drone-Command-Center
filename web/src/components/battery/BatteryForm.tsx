import { useState } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useToast } from "../ui/Toast";
import { useDroneStore } from "../../store/droneStore";
import { CommandError } from "../../api/droneMqtt";
import type { BatteryConfig } from "../../types";

export function BatteryForm() {
  const [capacityMah, setCapacityMah] = useState("10000");
  const [cells, setCells] = useState("6");
  const [minSafePercent, setMinSafePercent] = useState("25");
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const send = useDroneStore((state) => state.send);
  const { push } = useToast();

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await send<BatteryConfig>("battery", {
        capacity_mah: Number(capacityMah),
        cells: Number(cells),
        min_safe_percent: Number(minSafePercent),
      });
      push("Baterai disimpan. Hitungan mAh terpakai di-reset.", "ok");
    } catch (e) {
      const commandError = e as CommandError;
      setError(commandError.code ?? "battery_save_failed");
      push(`Gagal menyimpan baterai: ${commandError.code ?? ""}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="section-title">Ganti Baterai</div>
      <Input
        label="Kapasitas (mAh)"
        type="number"
        value={capacityMah}
        onChange={(e) => setCapacityMah(e.target.value)}
      />
      <Input
        label="Jumlah cell (S)"
        type="number"
        value={cells}
        onChange={(e) => setCells(e.target.value)}
      />
      <Input
        label="Batas sisa aman (%)"
        type="number"
        value={minSafePercent}
        onChange={(e) => setMinSafePercent(e.target.value)}
      />
      {error ? <span className="field-error" style={{ marginBottom: "var(--space-3)" }}>{error}</span> : null}
      <Button variant="primary" onClick={() => void save()} loading={busy}>
        Simpan Baterai
      </Button>
    </div>
  );
}
