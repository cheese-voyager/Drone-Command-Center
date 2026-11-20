import { Card } from "../components/ui/Card";
import { LiveVideo } from "../components/video/LiveVideo";
import { LiveDroneStrip } from "../components/telemetry/LiveDroneStrip";

export function VideoPage() {
  return (
    <div className="page-fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Kamera</h1>
          <p className="page-sub">Live preview kamera via MJPEG.</p>
        </div>
      </div>

      <LiveDroneStrip />

      <Card title="Live preview" meta="MJPEG /video" className="fit-video-card">
        <LiveVideo />
      </Card>
    </div>
  );
}
