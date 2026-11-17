import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  icon?: ReactNode;
}

export function Stat({ label, value, unit, sub, icon }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-head">
        {icon}
        <span className="metric-label">{label}</span>
      </div>
      <div className="stat-value">
        <b>{value}</b>
        {unit ? <span>{unit}</span> : null}
      </div>
      {sub ? <span className="metric-sub">{sub}</span> : null}
    </div>
  );
}