import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export type PageLegendTone = "drone" | "route" | "drop" | "weather" | "ok" | "warn" | "error" | "info";

export interface PageLegendItem {
  label: string;
  tone?: PageLegendTone;
}

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: ReactNode;
  detail?: { label: string; to: string };
  actions?: ReactNode;
  meta?: ReactNode;
  source?: string;
  legend?: PageLegendItem[];
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  detail,
  actions,
  meta,
  source,
  legend,
  className,
}: PageHeaderProps) {
  const hasContext = Boolean(source || legend?.length);

  return (
    <header className={`page-head${className ? ` ${className}` : ""}`}>
      <div className="page-heading">
        <span className="page-eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        <div className="page-sub">{description}</div>
        {meta || hasContext ? (
          <div className="page-meta">
            {meta}
            {hasContext ? (
              <div className="page-context">
                {source ? <span className="page-source">{source}</span> : null}
                {legend?.length ? (
                  <div className="page-legend" aria-label="Legenda">
                    {legend.map((item) => (
                      <span key={item.label}>
                        <i className={`legend-mark ${item.tone ?? "drone"}`} aria-hidden />
                        {item.label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="page-actions">
        {detail ? (
          <Link className="btn btn-ghost btn-sm" to={detail.to}>
            {detail.label}
          </Link>
        ) : null}
        {actions}
      </div>
    </header>
  );
}
