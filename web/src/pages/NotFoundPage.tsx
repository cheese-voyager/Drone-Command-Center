import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="empty">
      <h1 className="page-title">404</h1>
      <p className="page-sub" style={{ margin: "var(--space-3) 0 0" }}>
        Halaman tidak ditemukan.
      </p>
      <Link to="/">Kembali ke Dashboard</Link>
    </div>
  );
}
