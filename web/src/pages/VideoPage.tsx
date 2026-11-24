import { Card } from "../components/ui/Card";
import { LiveVideo } from "../components/video/LiveVideo";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";
import { PageHeader } from "../components/layout/PageHeader";
import { useDroneStore } from "../store/droneStore";

export function VideoPage() {
  const backendOnline = useDroneStore((state) => state.backendOnline);

  return (
    <div className="page-fit">
      <PageHeader
        className="feature-page-head"
        eyebrow="Operasi visual"
        title="Kamera"
        description="Pratinjau langsung stream MJPEG dari kamera drone. Gunakan halaman detail kamera untuk metadata perangkat dan pemeriksaan koneksi endpoint."
        detail={{ label: "Detail kamera", to: "/detail/video" }}
        meta={
          <div className="page-stats" aria-label="Ringkasan kamera">
            <span>
              Stream <b>MJPEG</b>
            </span>
            <span>
              Endpoint <b>/video</b>
            </span>
            <span>
              Backend <b>{backendOnline ? "Online" : "Offline"}</b>
            </span>
          </div>
        }
        source="GET /video · MQTT status"
        legend={[
          { label: "Stream", tone: "info" },
          { label: "Telemetri", tone: "ok" },
        ]}
      />

      <LiveDroneStrip />

      <Card title="Pratinjau langsung" meta="MJPEG /video" className="fit-video-card">
        <LiveVideo />
      </Card>
    </div>
  );
}
