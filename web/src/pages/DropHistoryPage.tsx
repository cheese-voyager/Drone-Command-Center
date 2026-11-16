import { useDropHistory } from "../hooks/useDropHistory";
import { DropHistoryTable } from "../components/drop/DropHistoryTable";
import { useDroneStatus } from "../hooks/useDroneStatus";

export function DropHistoryPage() {
  const { lastDrop } = useDroneStatus();
  const drops = useDropHistory(lastDrop);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Riwayat Drop</h1>
          <p className="page-sub">Daftar titik drop yang telah tercatat.</p>
        </div>
      </div>
      <div className="card card-pad">
        <DropHistoryTable drops={drops} />
      </div>
    </div>
  );
}
