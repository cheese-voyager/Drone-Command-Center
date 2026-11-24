import { Card } from "../../components/ui/Card";
import { LiveVideo } from "../../components/video/LiveVideo";
import { DetailMetrics } from "../../components/detail/DetailPrimitives";
import { useBackendUrl } from "../../hooks/useBackendUrl";
import { useDroneStore } from "../../store/droneStore";

export function VideoDetailPage() {
  const { apiUrl } = useBackendUrl();
  const status = useDroneStore((state) => state.status);

  return (
    <div className="detail-page">
      <Card title="Pratinjau langsung" meta="MJPEG /video">
        <div className="detail-video-frame">
          <LiveVideo />
        </div>
      </Card>

      <Card title="Koneksi kamera" meta="Backend endpoint">
        <DetailMetrics
          items={[
            { label: "Endpoint", value: `${apiUrl.replace(/\/$/, "")}/video` },
            { label: "Drone", value: status?.connected ? "TERHUBUNG" : "TERPUTUS" },
            { label: "Mode", value: status?.mode ?? "-" },
            {
              label: "Posisi",
              value:
                status && status.lat !== null && status.lon !== null
                  ? `${status.lat.toFixed(6)}, ${status.lon.toFixed(6)}`
                  : "-",
            },
          ]}
        />
      </Card>

      <Card title="Metadata kamera" meta="Belum tersedia dari endpoint">
        <DetailMetrics
          items={[
            { label: "Nama kamera", value: "-" },
            { label: "Resolusi", value: "-" },
            { label: "Frame rate", value: "-" },
            { label: "Exposure", value: "-" },
            { label: "Zoom", value: "-" },
            { label: "Fokus", value: "-" },
            { label: "Waktu terakhir", value: "-" },
            { label: "Format", value: "MJPEG" },
          ]}
        />
      </Card>
    </div>
  );
}
