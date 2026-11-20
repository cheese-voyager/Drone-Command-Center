import { useState } from "react";
import { Card } from "../ui/Card";
import { BarChart } from "../charts/BarChart";
import { DropHistoryTable } from "./DropHistoryTable";
import { dropBucketsByDay, dropBucketsByHour, summarizeDrops } from "../../utils/dropStats";
import { fmtDuration, fmtNumber } from "../../utils/format";
import type { DropRecord } from "../../types";

interface DropHistoryPanelProps {
  drops: DropRecord[];
}

export function DropHistoryPanel({ drops }: DropHistoryPanelProps) {
  const summary = summarizeDrops(drops);
  const [bucketMode, setBucketMode] = useState<"hour" | "day">("hour");
  const buckets = bucketMode === "hour" ? dropBucketsByHour(drops) : dropBucketsByDay(drops);

  return (
    <div className="fit-2col fit-history-grid">
      <div className="fit-col">
        <Card title="Ringkasan drop" meta="Sesi ini">
          <div className="grid grid-2" style={{ gap: "var(--space-3)" }}>
            <div className="metric">
              <span className="metric-label">Total drop</span>
              <span className="metric-value small">{summary.count}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Berkoordinat</span>
              <span className="metric-value small">{summary.located}</span>
            </div>
            <div className="metric">
              <span className="metric-label">Rata-rata thrust</span>
              <span className="metric-value small">
                {summary.avg_thrust === null ? "-" : `${fmtNumber(summary.avg_thrust, 0)}%`}
              </span>
            </div>
            <div className="metric">
              <span className="metric-label">Total durasi</span>
              <span className="metric-value small">{fmtDuration(summary.total_duration_s)}</span>
            </div>
          </div>
        </Card>
        <Card
          title="Sebaran drop"
          meta={bucketMode === "hour" ? "Per jam" : "Per hari"}
          className="fit-card grow"
          actions={
            <div className="flex gap-1">
              <button
                type="button"
                className={`btn btn-sm ${bucketMode === "hour" ? "btn-primary" : "btn-secondary"}`}
                aria-pressed={bucketMode === "hour"}
                onClick={() => setBucketMode("hour")}
              >
                Per jam
              </button>
              <button
                type="button"
                className={`btn btn-sm ${bucketMode === "day" ? "btn-primary" : "btn-secondary"}`}
                aria-pressed={bucketMode === "day"}
                onClick={() => setBucketMode("day")}
              >
                Per hari
              </button>
            </div>
          }
        >
          <BarChart
            data={buckets.map((bucket) => ({ label: bucket.label, value: bucket.value, color: "var(--warn)" }))}
            height="100%"
            emptyText="Belum ada drop"
          />
        </Card>
      </div>
      <Card title="Titik drop" meta={`${drops.length} total`} className="fit-card">
        <DropHistoryTable drops={drops} />
      </Card>
    </div>
  );
}
