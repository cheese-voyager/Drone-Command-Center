interface BatteryGaugeProps {
  percent: number;
  size?: number;
}

export function BatteryGauge({ percent, size = 160 }: BatteryGaugeProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 70;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (clamped / 100) * circumference;
  const color = clamped < 25 ? "var(--error)" : clamped < 50 ? "var(--warn)" : "var(--primary)";

  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 180 180">
        <circle className="gauge-track" cx="90" cy="90" r={r} fill="none" strokeWidth="14" />
        <circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 90 90)"
        />
      </svg>
      <div className="gauge-value">
        <b>{clamped.toFixed(0)}%</b>
        <span>Sisa</span>
      </div>
    </div>
  );
}
