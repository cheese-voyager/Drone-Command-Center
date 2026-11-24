import { useState } from "react";
import { useBackendUrl } from "../../hooks/useBackendUrl";

export function LiveVideo() {
  const url = useBackendUrl();
  const [failed, setFailed] = useState(false);
  const videoSrc = `${url.apiUrl.replace(/\/$/, "")}/video`;

  return (
    <div className="video-frame">
      <img src={videoSrc} alt="Pratinjau kamera" onError={() => setFailed(true)} />
      {failed ? <div className="empty">Kamera tidak tersedia. Cek /video di backend.</div> : null}
    </div>
  );
}
