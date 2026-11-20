export interface ChartSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

interface LineChartProps {
  series: ChartSeries[];
  labels?: string[];
  height?: number;
  format?: (value: number) => string;
  fill?: boolean;
}

function buildSegments(values: (number | null)[], min: number, max: number): string[] {
  const span = max - min || 1;
  const segments: string[] = [];
  let segment = "";
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      if (segment) segments.push(segment);
      segment = "";
      return;
    }
    const x = values.length > 1 ? (index / (values.length - 1)) * 100 : 50;
    const y = 100 - ((value - min) / span) * 100;
    segment += `${segment ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)} `;
  });
  if (segment) segments.push(segment);
  return segments;
}

export function LineChart({ series, labels, height = 150, format = (value) => value.toFixed(1), fill = false }: LineChartProps) {
  const finite = series.flatMap((item) => item.values.filter((value): value is number => value !== null && Number.isFinite(value)));
  const hasData = finite.length >= 2;

  if (!hasData) {
    return <div className="chart-empty" style={{ height }}>Belum ada data</div>;
  }

  const rawMax = Math.max(...finite);
  const rawMin = Math.min(...finite);
  const padding = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.12;
  const max = rawMax + padding;
  const min = Math.max(0, rawMin - padding);

  return (
    <div className="chart" style={{ height }}>
      <div className="chart-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" role="img" aria-label={`Grafik ${series.map((s) => s.label).join(", ")}`}>
          {[0, 25, 50, 75, 100].map((y) => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} className="chart-grid" />
          ))}
          {series.map((item) => {
            const segments = buildSegments(item.values, min, max);
            const area = fill && segments.length === 1 ? `${segments[0]}L100 100 L0 100 Z` : null;
            return (
              <g key={item.label}>
                {area ? <path d={area} fill={item.color} opacity="0.12" stroke="none" /> : null}
                {segments.map((path, index) => (
                  <path
                    key={index}
                    d={path}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ))}
              </g>
            );
          })}
        </svg>
        <span className="chart-y chart-ymax">{format(rawMax)}</span>
        <span className="chart-y chart-ymin">{format(rawMin)}</span>
      </div>
      {labels && labels.length > 1 ? (
        <div className="chart-x">
          <span>{labels[0]}</span>
          <span>{labels[Math.floor((labels.length - 1) / 2)]}</span>
          <span>{labels[labels.length - 1]}</span>
        </div>
      ) : null}
      <div className="chart-legend">
        {series.map((item) => {
          const values = item.values.filter((value): value is number => value !== null && Number.isFinite(value));
          const last = values.length > 0 ? values[values.length - 1] : null;
          return (
            <span key={item.label} className="chart-legend-item">
              <i style={{ background: item.color }} />
              {item.label}
              <b>{last === null ? "-" : format(last)}</b>
            </span>
          );
        })}
      </div>
    </div>
  );
}
