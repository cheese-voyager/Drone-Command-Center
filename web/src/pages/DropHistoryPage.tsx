import { useDropHistory } from "../hooks/useDropHistory";
import { DropHistoryTable } from "../components/drop/DropHistoryTable";
import { Card } from "../components/ui/Card";
import { useDroneStore } from "../store/droneStore";

export function DropHistoryPage() {
  const lastDrop = useDroneStore((state) => state.lastDrop);
  const drops = useDropHistory(lastDrop);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Riwayat Drop</h1>
          <p className="page-sub">Daftar titik drop yang telah tercatat.</p>
        </div>
      </div>
      <Card title="Titik drop" meta={`${drops.length} total`}>
        <DropHistoryTable drops={drops} />
      </Card>
    </div>
  );
}
