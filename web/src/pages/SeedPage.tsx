import { SeedCounter } from "../components/seed/SeedCounter";
import { SeedLoadForm } from "../components/seed/SeedLoadForm";
import { Card } from "../components/ui/Card";
import { BarChart } from "../components/charts/BarChart";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";
import { useDroneStore } from "../store/droneStore";
import { exportSeedExcel, exportSeedPdf } from "../utils/reports";
import { GPS_FIX_NAMES } from "../utils/constants";
import { fmtCoord, fmtInt, fmtNumber } from "../utils/format";

export function SeedPage() {
  const status = useDroneStore((state) => state.status);
  const history = useDroneStore((state) => state.history);
  const seed = status?.seed;
  const total = (seed?.loaded ?? 0) > 0 ? (seed?.loaded ?? 0) : Math.max(1, seed?.remaining ?? 0);

  return (
    <div className="page-fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Benih</h1>
          <p className="page-sub">Jumlah benih yang dimuat, terdrop, dan sisa.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => exportSeedPdf(seed, history)}>
            Unduh PDF
          </button>
          <button className="btn btn-secondary" onClick={() => exportSeedExcel(seed, history)}>
            Unduh Excel
          </button>
        </div>
      </div>

      <LiveDroneStrip />

      <div className="fit-2col">
        <div className="fit-col">
          <SeedCounter />
          <Card title="Komposisi benih" meta={`${fmtInt(seed?.remaining)} sisa`} className="fit-card grow seed-composition">
            <BarChart
              data={[
                { label: "Dimuat", value: seed?.loaded ?? 0, color: "var(--info)" },
                { label: "Di-drop", value: seed?.dropped ?? 0, color: "var(--warn)" },
                { label: "Sisa", value: seed?.remaining ?? 0, color: "var(--ok)" },
              ]}
              height="100%"
            />
            <p className="hint">Grafik mengikuti status benih terbaru dari telemetri.</p>
          </Card>
        </div>
        <div className="fit-col">
          <SeedLoadForm />
          <Card title="Data pendukung" meta="Telemetri" className="fit-card grow seed-support">
            <dl className="kv">
              <dt>Persentase sisa</dt>
              <dd>{seed === undefined ? "-" : `${fmtNumber(((seed?.remaining ?? 0) / total) * 100, 0)} %`}</dd>
              <dt>Mode terbang</dt>
              <dd>{status?.mode ?? "-"}</dd>
              <dt>Ketinggian</dt>
              <dd>{fmtNumber(status?.alt ?? null)} m</dd>
              <dt>Kecepatan</dt>
              <dd>{fmtNumber(status?.speed ?? null)} m/s</dd>
              <dt>Koordinat</dt>
              <dd>{fmtCoord(status?.lat ?? null, status?.lon ?? null)}</dd>
              <dt>GPS</dt>
              <dd>{status?.gps_fix == null ? "-" : GPS_FIX_NAMES[status.gps_fix] ?? "-"}</dd>
              <dt>Satelit</dt>
              <dd>{fmtInt(status?.satellites ?? null)}</dd>
              <dt>Baterai</dt>
              <dd>{fmtNumber(status?.battery?.remaining_percent ?? null, 0)} %</dd>
              <dt>Tegangan</dt>
              <dd>{fmtNumber(status?.voltage ?? null, 2)} V</dd>
              <dt>Arus</dt>
              <dd>{fmtNumber(status?.current ?? null)} A</dd>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
