import type { BmkgSlot } from "../api/bmkg";

export type RiskLevel = "ok" | "warn" | "bad";

export interface FlightRisk {
  level: RiskLevel;
  reasons: string[];
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const COMPASS_ID = ["U", "TL", "T", "TG", "S", "BD", "B", "BL"];

/** Timestamp (ms) sebuah slot. `datetime` BMKG memakai format ISO UTC. */
export function slotMs(slot: BmkgSlot): number {
  const raw = slot.datetime ?? (slot.utc_datetime ? `${slot.utc_datetime.replace(" ", "T")}Z` : null);
  if (!raw) return Number.NaN;
  return Date.parse(raw);
}

/** Slot yang paling relevan untuk "sekarang" (slot terakhir yang sudah mulai). */
export function pickCurrentSlot(slots: BmkgSlot[], now: number = Date.now()): BmkgSlot | null {
  if (slots.length === 0) return null;
  let current: BmkgSlot | null = null;
  for (const slot of slots) {
    const ms = slotMs(slot);
    if (Number.isNaN(ms)) continue;
    if (ms <= now) {
      current = slot;
    } else if (current === null) {
      return slot;
    } else {
      break;
    }
  }
  return current ?? slots[0] ?? null;
}

/** Beberapa slot berikutnya mulai dari sekarang. */
export function upcomingSlots(slots: BmkgSlot[], count = 8, now: number = Date.now()): BmkgSlot[] {
  const next = slots.filter((slot) => {
    const ms = slotMs(slot);
    return !Number.isNaN(ms) && ms >= now;
  });
  return next.slice(0, Math.max(0, count));
}

/** Jam lokal slot, mis. "21:00". */
export function fmtSlotClock(slot: BmkgSlot | null | undefined): string {
  const local = slot?.local_datetime;
  if (!local || local.length < 16) return "--:--";
  return local.slice(11, 16);
}

/** Tanggal lokal slot, mis. "18/11". */
export function fmtSlotDay(slot: BmkgSlot | null | undefined): string {
  const local = slot?.local_datetime;
  if (!local || local.length < 10) return "--/--";
  return `${local.slice(8, 10)}/${local.slice(5, 7)}`;
}

/** Waktu rilis prakiraan (analysis_date UTC) dalam WIB. */
export function fmtAnalysis(value: string | null | undefined): string {
  if (!value) return "-";
  const iso = value.endsWith("Z") ? value : `${value}Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const wib = new Date(d.getTime() + WIB_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(wib.getUTCDate())}/${p(wib.getUTCMonth() + 1)} ${p(wib.getUTCHours())}:${p(wib.getUTCMinutes())} WIB`;
}

/** Arah mata angin (8 arah) dari derajat. */
export function compassFromDeg(deg: number | null | undefined): string | null {
  if (deg === null || deg === undefined || Number.isNaN(deg)) return null;
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS_ID[Math.round(normalized / 45) % 8];
}

/** Teks angin, mis. "12 km/jam dari S". */
export function windText(slot: BmkgSlot | null | undefined): string {
  if (!slot || slot.ws === null || slot.ws === undefined) return "-";
  const dir = slot.wd ?? compassFromDeg(slot.wd_deg);
  return dir ? `${slot.ws} km/jam dari ${dir}` : `${slot.ws} km/jam`;
}

/** Penilaian ringkas kelayakan terbang untuk satu slot. */
export function assessSlot(slot: BmkgSlot | null | undefined): FlightRisk {
  const reasons: string[] = [];
  let level: RiskLevel = "ok";
  if (!slot) return { level, reasons };

  const bump = (next: RiskLevel) => {
    if (next === "bad" || (next === "warn" && level === "ok")) {
      level = next;
    }
  };

  if (slot.ws !== null && slot.ws !== undefined) {
    if (slot.ws >= 30) {
      bump("bad");
      reasons.push(`Angin kencang ${slot.ws} km/jam`);
    } else if (slot.ws >= 20) {
      bump("warn");
      reasons.push(`Angin ${slot.ws} km/jam`);
    }
  }

  if (slot.tp !== null && slot.tp !== undefined && slot.tp > 0) {
    if (slot.tp >= 2) {
      bump("bad");
      reasons.push(`Hujan ${slot.tp} mm`);
    } else {
      bump("warn");
      reasons.push(`Potensi hujan ${slot.tp} mm`);
    }
  }

  if (slot.weather !== null && slot.weather !== undefined && slot.weather >= 95) {
    bump("bad");
    reasons.push("Potensi hujan petir");
  }

  if (slot.vs !== null && slot.vs !== undefined && slot.vs > 0) {
    if (slot.vs < 2000) {
      bump("bad");
      reasons.push(`Jarak pandang rendah (${slot.vs_text ?? `${slot.vs} m`})`);
    } else if (slot.vs < 5000) {
      bump("warn");
      reasons.push("Jarak pandang terbatas");
    }
  }

  return { level, reasons };
}
