export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDatum[];
  height?: number | string;
  format?: (value: number) => string;
  emptyText?: string;
}

export function BarChart({ data, height = 120, format = (value) => String(value), emptyText = "Belum ada data" }: BarChartProps) {
  if (data.length === 0 || data.every((item) => item.value === 0)) {
    return <div className="chart-empty" style={{ height }}>{emptyText}</div>;
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="barchart" style={{ height }}>
      {data.map((item) => {
        const percent = item.value === 0 ? 0 : Math.max(2, (item.value / max) * 100);
        return (
          <div key={item.label} className="barchart-col">
            <span className="barchart-val">{format(item.value)}</span>
            <div className="barchart-track">
              <span style={{ height: `${percent}%`, background: item.color ?? "var(--primary)" }} />
            </div>
            <span className="barchart-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
