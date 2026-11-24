import { useState } from "react";
import { Button } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { useToast } from "../ui/Toast";
import { useDroneStore } from "../../store/droneStore";
import { CommandError } from "../../api/droneMqtt";
import { useBackendUrl } from "../../hooks/useBackendUrl";
import { MOTOR_TEST_MAX_PERCENT, TEST_TARGETS, DEFAULT_TEST_DURATION_S } from "../../utils/constants";
import type { TestTarget, ThrusterTestResponse } from "../../types";

export function ThrusterTestForm() {
  const send = useDroneStore((state) => state.send);
  const { push } = useToast();
  const url = useBackendUrl();

  const [target, setTarget] = useState<TestTarget>("seeder");
  const [thrustPercent, setThrustPercent] = useState("20");
  const [durationS, setDurationS] = useState(String(DEFAULT_TEST_DURATION_S));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const isMotor = target !== "seeder";
  const maxThrust = isMotor ? MOTOR_TEST_MAX_PERCENT : 100;

  const run = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await send<ThrusterTestResponse>("thruster-test", {
        target,
        thrust_percent: Number(thrustPercent),
        duration_s: Number(durationS),
      });
      push("Tes thruster dikirim. Berhenti otomatis setelah durasi.", "ok");
      void result;
      void url;
    } catch (e) {
      const commandError = e as CommandError;
      setError(commandError.code ?? "thruster_test_failed");
      push(`Tes gagal: ${commandError.code ?? ""}`, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-pad">
      <div className="section-title">Tes thruster</div>
      <label className="label" htmlFor="thr-target">Yang dites</label>
      <select id="thr-target" className="input" value={target} onChange={(e) => setTarget(e.target.value as TestTarget)}>
        {TEST_TARGETS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {isMotor ? (
        <p className="hint" style={{ marginTop: "var(--space-2)" }}>
          Tes motor hanya boleh saat drone <strong>disarm</strong> dan thrust maksimal {MOTOR_TEST_MAX_PERCENT}%.
        </p>
      ) : null}
      <Slider
        label="Thrust (%)"
        min={0}
        max={maxThrust}
        step={1}
        value={Number(thrustPercent)}
        valueLabel={`${thrustPercent}%`}
        onChange={(e) => setThrustPercent(e.target.value)}
      />
      <Slider
        label="Durasi (detik)"
        min={0.5}
        max={10}
        step={0.5}
        value={Number(durationS)}
        valueLabel={`${durationS}s`}
        onChange={(e) => setDurationS(e.target.value)}
      />
      {error ? <span className="field-error" style={{ marginBottom: "var(--space-3)" }}>{error}</span> : null}
      <Button variant="primary" onClick={() => void run()} loading={busy}>
        Jalankan Tes
      </Button>
    </div>
  );
}
