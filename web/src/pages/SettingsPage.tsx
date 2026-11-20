import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useBackendUrl } from "../hooks/useBackendUrl";
import { useDroneStore } from "../store/droneStore";
import { useSettingsStore } from "../store/settingsStore";
import { isValidCoord } from "../utils/geo";

export function SettingsPage() {
  const { apiUrl, username, password, brokerHost, setApiUrl, setUsername, setPassword, setBrokerHost } = useBackendUrl();
  const client = useDroneStore((state) => state.client);
  const weatherUseManual = useSettingsStore((state) => state.weatherUseManual);
  const weatherLat = useSettingsStore((state) => state.weatherLat);
  const weatherLon = useSettingsStore((state) => state.weatherLon);
  const setWeatherUseManual = useSettingsStore((state) => state.setWeatherUseManual);
  const setWeatherLat = useSettingsStore((state) => state.setWeatherLat);
  const setWeatherLon = useSettingsStore((state) => state.setWeatherLon);
  const [saved, setSaved] = useState(false);

  const manualLat = Number(weatherLat);
  const manualLon = Number(weatherLon);
  const manualFilled = weatherLat.trim() !== "" && weatherLon.trim() !== "";
  const manualValid = manualFilled && Number.isFinite(manualLat) && Number.isFinite(manualLon) && isValidCoord(manualLat, manualLon);
  const manualError = weatherUseManual && !manualValid ? "Isi latitude (-90..90) dan longitude (-180..180) yang valid." : "";

  const save = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="page-fit">
      <div className="page-head">
        <div>
          <h1 className="page-title">Pengaturan</h1>
          <p className="page-sub">Koneksi backend dan broker MQTT.</p>
        </div>
      </div>
      <div className="fit-2col">
        <Card title="Backend" className="fit-card">
          <label className="label" htmlFor="setting-api">Alamat API</label>
          <input id="setting-api" className="input" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          <label className="label" htmlFor="setting-user">Username MQTT</label>
          <input id="setting-user" className="input" value={username} onChange={(e) => setUsername(e.target.value)} />
          <label className="label" htmlFor="setting-pass">Password MQTT</label>
          <input id="setting-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <label className="label" htmlFor="setting-broker">Broker Host</label>
          <input id="setting-broker" className="input" value={brokerHost} onChange={(e) => setBrokerHost(e.target.value)} />

          <div className="metric-label" style={{ marginTop: "var(--space-4)" }}>
            Lokasi cuaca BMKG
          </div>
          <label className="check-row compact" htmlFor="setting-weather-manual">
            <input
              id="setting-weather-manual"
              type="checkbox"
              checked={weatherUseManual}
              onChange={(e) => setWeatherUseManual(e.target.checked)}
            />
            <div className="grow">
              Gunakan koordinat manual
              <small>Jika tidak aktif, cuaca memakai posisi GPS drone.</small>
            </div>
          </label>
          <div className="grid grid-2" style={{ gap: "var(--space-3)" }}>
            <div>
              <label className="label" htmlFor="setting-weather-lat">Latitude</label>
              <input
                id="setting-weather-lat"
                className="input"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="-6.200000"
                value={weatherLat}
                onChange={(e) => setWeatherLat(e.target.value)}
                disabled={!weatherUseManual}
              />
            </div>
            <div>
              <label className="label" htmlFor="setting-weather-lon">Longitude</label>
              <input
                id="setting-weather-lon"
                className="input"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="106.816666"
                value={weatherLon}
                onChange={(e) => setWeatherLon(e.target.value)}
                disabled={!weatherUseManual}
              />
            </div>
          </div>
          {manualError ? <p className="field-error">{manualError}</p> : null}
          {!manualError ? <p className="hint">Koordinat ini dipakai pada halaman detail cuaca.</p> : null}
          <div className="flex gap-2" style={{ marginTop: "var(--space-2)" }}>
            <Link className="btn btn-secondary btn-sm" to="/weather">
              Buka detail cuaca
            </Link>
          </div>

          <div className="flex center gap-3" style={{ marginTop: "var(--space-3)" }}>
            <button className="btn btn-primary" onClick={save}>
              Simpan
            </button>
            {saved ? <span className="hint">Tersimpan.</span> : null}
          </div>
        </Card>
        <Card title="Koneksi MQTT" meta={client?.info.connected ? "Terhubung" : "Terputus"} className="fit-card">
          <dl className="kv">
            <dt>Status</dt>
            <dd>{client ? (client.info.connected ? "terhubung" : "terputus") : "belum terhubung"}</dd>
            <dt>Broker</dt>
            <dd>{client ? `${client.info.host}:${client.info.port}` : "-"}</dd>
            <dt>WebSocket</dt>
            <dd>{client ? `${client.info.host}:${client.info.ws_port}` : "-"}</dd>
            <dt>Base topic</dt>
            <dd>{client ? client.info.base_topic : "-"}</dd>
            <dt>Perintah</dt>
            <dd>{client ? (client.info.commands_enabled ? "aktif" : "nonaktif") : "-"}</dd>
            <dt>Topik status</dt>
            <dd>{client ? client.info.topics.status : "-"}</dd>
            <dt>Topik drop</dt>
            <dd>{client ? client.info.topics.drop_event : "-"}</dd>
          </dl>
        </Card>
      </div>
    </div>
  );
}
