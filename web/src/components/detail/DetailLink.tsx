import { Link } from "react-router-dom";

export function DetailLink({ to, label = "Buka detail" }: { to: string; label?: string }) {
  return (
    <Link className="icon-btn detail-link" to={to} aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    </Link>
  );
}
