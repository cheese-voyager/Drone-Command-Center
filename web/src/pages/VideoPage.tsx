import { Card } from "../components/ui/Card";
import { LiveVideo } from "../components/video/LiveVideo";

export function VideoPage() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Kamera</h1>
          <p className="page-sub">Live preview kamera via MJPEG.</p>
        </div>
      </div>
      <Card title="Live preview" meta="MJPEG /video">
        <LiveVideo />
      </Card>
    </div>
  );
}
