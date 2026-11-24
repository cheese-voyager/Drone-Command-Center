import type { ReactNode } from "react";

export interface DetailMetricItem {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}

export function DetailMetrics({ items, className = "grid-4" }: { items: DetailMetricItem[]; className?: string }) {
  return (
    <div className={`grid ${className}`}>
      {items.map((item) => (
        <div className="metric" key={item.label}>
          <span className="metric-label">{item.label}</span>
          <span className="metric-value small">{item.value}</span>
          {item.sub ? <span className="metric-sub">{item.sub}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function DetailBar({
  value,
  max = 100,
  tone = "",
}: {
  value: number | null;
  max?: number;
  tone?: "" | "ok" | "warn" | "error";
}) {
  const safeMax = max > 0 ? max : 1;
  const percent =
    value === null || !Number.isFinite(value)
      ? 0
      : Math.max(0, Math.min(100, (value / safeMax) * 100));
  return (
    <div className={`bar ${tone}`.trim()}>
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

export function DetailEmpty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
