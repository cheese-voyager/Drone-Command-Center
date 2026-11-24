import type { ReactNode } from "react";
import { DetailBar } from "./DetailPrimitives";
import { Card } from "../ui/Card";
import { useDroneStore } from "../../store/droneStore";
import { GPS_FIX_NAMES } from "../../utils/constants";
import { fmtCoord, fmtDateTime } from "../../utils/format";

type Tone = "" | "ok" | "warn" | "error";
type BadgeTone = Tone | "primary";
type RawRecord = Record<string, unknown>;

const DASH = "-";

function asRecord(value: unknown): RawRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as RawRecord) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value.trim() || DASH;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return DASH;
}

function asBool(value: unknown): string {
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  return DASH;
}

function num(value: unknown, digits = 1, suffix = ""): string {
  const parsed = asNumber(value);
  return parsed === null ? DASH : `${parsed.toFixed(digits)}${suffix}`;
}

function int(value: unknown, suffix = ""): string {
  const parsed = asNumber(value);
  return parsed === null ? DASH : `${Math.round(parsed)}${suffix}`;
}

function timeLabel(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return DASH;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? DASH : fmtDateTime(ms / 1000);
}

function badgeClass(tone: BadgeTone): string {
  return tone ? `badge badge-${tone}` : "badge";
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="mp-kv">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Section({
  title,
  meta,
  tone = "",
  children,
}: {
  title: string;
  meta?: ReactNode;
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <section className="mp-section">
      <div className="mp-section-head">
        <span className="mp-section-title">{title}</span>
        {meta ? <span className={badgeClass(tone)}>{meta}</span> : null}
      </div>
      {children}
    </section>
  );
}

function severityTone(value: unknown): Tone {
  const severity = asNumber(value);
  if (severity === null) return "";
  if (severity <= 2) return "error";
  if (severity === 3) return "warn";
  return "ok";
}

export function MissionPlannerGroups() {
  const status = useDroneStore((state) => state.status);
  const raw = status as unknown as RawRecord | null;

  if (!raw) {
    return (
      <Card title="Mission Planner" meta="Telemetri terolah" className="detail-mp-card">
        <div className="mp-empty">
          <b>Menunggu data Mission Planner</b>
          <span>Data Pixhawk akan dirangkum otomatis di sini.</span>
        </div>
      </Card>
    );
  }

  const mission = asRecord(raw.mission);
  const gps = asRecord(raw.gps);
  const nav = asRecord(raw.nav);
  const health = asRecord(raw.health);
  const link = asRecord(raw.link);
  const power = asRecord(raw.power);
  const servo = asRecord(raw.servo);
  const time = asRecord(raw.time);

  const failsafe = asArray(health.failsafe)
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  const currentWp = asNumber(mission.current_wp);
  const totalWp = asNumber(mission.total_wp);
  const progress = totalWp !== null && totalWp > 0 ? Math.max(0, Math.min(100, ((currentWp ?? 0) / totalWp) * 100)) : null;

  const targetBearing = asNumber(mission.target_bearing_deg);
  const navBearing = asNumber(mission.nav_bearing_deg);
  const bearingDelta =
    targetBearing !== null && navBearing !== null
      ? Math.abs(((targetBearing - navBearing + 540) % 360) - 180)
      : null;

  const fix = asNumber(gps.fix_type);
  const satellites = asNumber(gps.satellites_visible);
  const fixLabel = fix === null ? DASH : GPS_FIX_NAMES[fix] ?? `Fix ${fix}`;
  const gpsTone: Tone = fix === null || fix < 2 ? "error" : fix === 2 || (satellites !== null && satellites < 8) ? "warn" : "ok";

  const rssi = asNumber(link.rssi);
  const noise = asNumber(link.noise);
  const linkMargin = rssi !== null && noise !== null ? rssi - noise : rssi;
  const linkTone: Tone = linkMargin === null ? "error" : linkMargin < 10 ? "error" : linkMargin < 20 ? "warn" : "ok";

  const healthTone: Tone = failsafe.length > 0 || health.prearm_ok === false || health.ekf_ok === false ? "error" : "ok";
  const healthLabel =
    failsafe.length > 0
      ? "Failsafe aktif"
      : health.prearm_ok === false
        ? "PreArm belum siap"
        : health.ekf_ok === false
          ? "EKF tidak ok"
          : "Sistem sehat";

  const cells = asArray(power.cell_voltages_v)
    .map((value) => num(value, 2, " V"))
    .filter((value) => value !== DASH);
  const cellText = cells.length > 0 ? cells.join(" · ") : DASH;

  const channels = asArray(servo.channels).map(asRecord).slice(0, 8);
  const lastDrop = asRecord(servo.last_drop);
  const messages = asArray(raw.messages).map(asRecord).slice(0, 6);

  return (
    <Card
      title="Mission Planner"
      meta="Telemetri terolah"
      className="detail-mp-card"
      actions={<span className={badgeClass(healthTone)}>{healthLabel}</span>}
    >
      <div className="mp-dashboard">
        <Section title="Status misi" meta={asText(mission.state)} tone={progress === null ? "" : "ok"}>
          <div className="mp-mission-head">
            <div>
              <span>Progres waypoint</span>
              <b className="num">
                {currentWp ?? 0} / {totalWp ?? 0}
              </b>
            </div>
            <span className={badgeClass(progress === null ? "" : "primary")}>
              {progress === null ? DASH : `${progress.toFixed(0)}%`}
            </span>
          </div>
          <DetailBar value={progress} max={100} tone={progress === null ? "" : "ok"} />
          <div className="mp-kpis">
            <KeyValue label="Waypoint berikutnya" value={fmtCoord(asNumber(mission.next_wp_lat), asNumber(mission.next_wp_lon))} />
            <KeyValue label="Jarak ke WP" value={num(mission.wp_distance_m, 1, " m")} />
            <KeyValue label="Target bearing" value={num(mission.target_bearing_deg, 0, "°")} />
            <KeyValue label="Nav bearing" value={num(mission.nav_bearing_deg, 0, "°")} />
            <KeyValue label="Selisih arah" value={bearingDelta === null ? DASH : `${bearingDelta.toFixed(0)}°`} />
            <KeyValue label="Cross track" value={num(mission.xtrack_error_m, 2, " m")} />
          </div>
        </Section>

        <div className="mp-grid-2">
          <Section title="GPS dan waktu" meta={fixLabel} tone={gpsTone}>
            <div className="mp-kpis">
              <KeyValue label="Satelit" value={int(gps.satellites_visible)} />
              <KeyValue label="HDOP" value={num(gps.hdop, 2)} />
              <KeyValue label="VDOP" value={num(gps.vdop, 2)} />
              <KeyValue label="RTK" value={asText(gps.rtk_status)} />
              <KeyValue label="Alt MSL" value={num(gps.alt_msl_m, 1, " m")} />
              <KeyValue label="Kecepatan GPS" value={num(gps.speed_mps, 1, " m/s")} />
              <KeyValue label="COG" value={num(gps.cog_deg, 0, "°")} />
              <KeyValue label="Waktu UTC" value={timeLabel(time.utc)} />
            </div>
          </Section>

          <Section title="Navigasi" meta={asText(nav.wind_source)}>
            <div className="mp-kpis">
              <KeyValue label="Alt AMSL" value={num(nav.alt_amsl_m, 1, " m")} />
              <KeyValue label="Alt relatif" value={num(nav.alt_rel_m, 1, " m")} />
              <KeyValue label="Alt AGL" value={num(nav.alt_agl_m, 1, " m")} />
              <KeyValue label="Airspeed" value={num(nav.airspeed_mps, 1, " m/s")} />
              <KeyValue label="Groundspeed" value={num(nav.groundspeed_mps, 1, " m/s")} />
              <KeyValue label="Climb" value={num(nav.climb_mps, 1, " m/s")} />
              <KeyValue label="Throttle" value={num(nav.throttle_percent, 0, "%")} />
              <KeyValue label="Heading" value={num(nav.heading_deg, 0, "°")} />
              <KeyValue label="Angin" value={`${num(nav.wind_speed_mps, 1, " m/s")} · ${num(nav.wind_direction_deg, 0, "°")}`} />
            </div>
          </Section>

          <Section title="Kesehatan sistem" meta={healthLabel} tone={healthTone}>
            <div className="mp-kpis">
              <KeyValue label="PreArm" value={asBool(health.prearm_ok)} />
              <KeyValue label="EKF" value={asBool(health.ekf_ok)} />
              <KeyValue label="Sensor health" value={int(health.sensor_health)} />
              <KeyValue label="Vibrasi X/Y/Z" value={`${num(health.vibration_x, 2)} · ${num(health.vibration_y, 2)} · ${num(health.vibration_z, 2)}`} />
              <KeyValue label="Clipping" value={int(health.clipping_events)} />
              <KeyValue label="Drop komunikasi" value={num(health.comm_drop_rate, 2, "%")} />
              <KeyValue label="Error komunikasi" value={int(health.comm_errors)} />
            </div>
            <div className="mp-tags">
              {failsafe.length > 0 ? (
                failsafe.map((item) => (
                  <span className="badge badge-error" key={item}>
                    {item}
                  </span>
                ))
              ) : (
                <span className="mp-ok">Tidak ada failsafe aktif</span>
              )}
            </div>
          </Section>

          <Section title="Daya dan tautan" meta={`Link ${linkMargin === null ? DASH : `${linkMargin.toFixed(0)} dB`}`} tone={linkTone}>
            <div className="mp-kpis">
              <KeyValue label="Sumber daya" value={asText(power.source)} />
              <KeyValue label="Baterai" value={num(power.remaining_percent, 0, "%")} />
              <KeyValue label="Energi terpakai" value={num(power.energy_consumed_wh, 1, " Wh")} />
              <KeyValue label="Kapasitas energi" value={num(power.energy_capacity_wh, 1, " Wh")} />
              <KeyValue label="Suhu" value={num(power.temperature_c, 1, " °C")} />
              <KeyValue label="Beban" value={num(power.load_percent, 0, "%")} />
              <KeyValue label="USB / power brick" value={`${asBool(power.usb_connected)} / ${asBool(power.power_brick_out)}`} />
              <KeyValue label="Cell voltage" value={cellText} />
              <KeyValue label="RSSI / noise" value={`${int(link.rssi, " dBm")} / ${int(link.noise, " dBm")}`} />
              <KeyValue label="Rem RSSI / noise" value={`${int(link.remrssi, " dBm")} / ${int(link.remnoise, " dBm")}`} />
              <KeyValue label="RX error / fixed" value={`${int(link.rx_errors)} / ${int(link.fixed)}`} />
              <KeyValue label="TX buffer" value={num(link.txbuf_percent, 0, "%")} />
            </div>
          </Section>
        </div>

        <div className="mp-grid-2">
          <Section title="Servo" meta={lastDrop.time ? timeLabel(lastDrop.time) : "Belum ada drop"}>
            <div className="mp-list">
              <div className="mp-row">
                <span>Drop terakhir</span>
                <b>
                  CH {int(lastDrop.channel)} · PWM {int(lastDrop.pwm)} · {asText(lastDrop.ack_result)}
                </b>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>CH</th>
                  <th>Fungsi</th>
                  <th>PWM</th>
                  <th>Daya</th>
                </tr>
              </thead>
              <tbody>
                {channels.length > 0 ? (
                  channels.map((channel, index) => (
                    <tr key={`${int(channel.channel)}-${index}`}>
                      <td>{int(channel.channel)}</td>
                      <td>{asText(channel.function)}</td>
                      <td>{int(channel.pwm)}</td>
                      <td>{num(channel.percent, 0, "%")}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>Belum ada data servo</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Pesan status" meta={`${messages.length} terakhir`}>
            <div className="mp-list">
              {messages.length > 0 ? (
                messages.map((message, index) => (
                  <div className="mp-row" key={`${timeLabel(message.time)}-${index}`}>
                    <span>
                      <span className={badgeClass(severityTone(message.severity))}>{int(message.severity)}</span>{" "}
                      {asText(message.text)}
                    </span>
                    <b>{timeLabel(message.time)}</b>
                  </div>
                ))
              ) : (
                <span className="mp-ok">Belum ada pesan status</span>
              )}
            </div>
          </Section>
        </div>

        <details className="mp-raw-toggle">
          <summary>Lihat payload mentah · skema {int(raw.schema_version)}</summary>
          <pre className="mp-raw">{JSON.stringify(raw, null, 2)}</pre>
        </details>
      </div>
    </Card>
  );
}
