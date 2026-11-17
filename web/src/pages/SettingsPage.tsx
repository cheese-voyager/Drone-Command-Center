import { useState } from "react";
import { Card } from "../components/ui/Card";
import { useBackendUrl } from "../hooks/useBackendUrl";
import { useDroneStore } from "../store/droneStore";

export function SettingsPage() {
  const { apiUrl, username, password, brokerHost, setApiUrl, setUsername, setPassword, setBrokerHost } = useBackendUrl();
  const client = useDroneStore((state) => state.client);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <p className="page-sub">Koneksi backend dan broker MQTT.</p>
        </div>
      </div>
      <div className="grid grid-2">
        <Card title="Backend">
          <label className="label" htmlFor="setting-api">Alamat API</label>
          <input id="setting-api" className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          <label className="label" htmlFor="setting-user">Username MQTT</label>
          <input id="setting-user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="label" htmlFor="setting-pass">Password MQTT</label>
          <input id="setting-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="label" htmlFor="setting-broker">Broker Host</label>
          <input id="setting-broker" className="input" value={brokerHost} onChange={(e) => setBrokerHost(e.target.value)} />
          <button className="btn btn-primary" style={{ marginTop: "var(--space-3)" }} onClick={save}>
            Simpan
          </button>
          {saved ? <span className="hint" style={{ marginLeft: "var(--space-3)" }}>Tersimpan.</span> : null}
        </Card>
        <Card title="Koneksi MQTT">
          <dl className="kv">
            <dt>Status</dt>
            <dd>{client ? (client.info.connected ? "terhubung" : "terputus") : "belum terhubung"}</dd>
            <dt>Broker</dt>
            <dd>{client ? `${client.info.host}:${client.info.port}` : "-"}</dd>
            <dt>Base topic</dt>
            <dd>{client ? client.info.base_topic : "-"}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
