import { SeedCounter } from "../components/seed/SeedCounter";
import { SeedLoadForm } from "../components/seed/SeedLoadForm";

export function SeedPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Benih</h1>
          <p className="page-sub">Jumlah benih yang dimuat, terdrop, dan sisa.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <SeedCounter />
        <SeedLoadForm />
      </div>
    </div>
  );
}
