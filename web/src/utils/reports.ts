import type { BatteryStatus, DropRecord, SeedStatus, TelemetrySample } from "../types";
import { dropBuckets, summarizeDrops } from "./dropStats";
import { fileStamp, downloadPdf, downloadWorkbook, type Cell, type PdfReport } from "./download";
import { flightPathFromHistory, sampledPoints, summarizeFlight, type FlightSummary } from "./flight";
import { fmtDateTime, fmtDuration, fmtMinutes, fmtNumber } from "./format";

const CYAN: [number, number, number] = [45, 226, 230];
const GREEN: [number, number, number] = [61, 220, 151];
const AMBER: [number, number, number] = [255, 176, 32];

function timeText(ms: number | null): string {
  return ms === null ? "-" : new Date(ms).toLocaleString("id-ID", { hour12: false });
}

function coordText(lat: number | null, lon: number | null): string {
  if (lat === null || lon === null) return "-";
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

function summaryRows(summary: FlightSummary, drops: DropRecord[]): [string, string][] {
  const dropInfo = summarizeDrops(drops);
  return [
    ["Mulai", timeText(summary.start)],
    ["Selesai", timeText(summary.end)],
    ["Durasi", fmtDuration(summary.duration_s)],
    ["Jarak tempuh", `${fmtNumber(summary.distance_km, 3)} km`],
    ["Ketinggian maks", summary.max_alt === null ? "-" : `${fmtNumber(summary.max_alt)} m`],
    ["Ketinggian min", summary.min_alt === null ? "-" : `${fmtNumber(summary.min_alt)} m`],
    ["Kecepatan rata-rata", summary.avg_speed === null ? "-" : `${fmtNumber(summary.avg_speed)} m/s`],
    ["Kecepatan maks", summary.max_speed === null ? "-" : `${fmtNumber(summary.max_speed)} m/s`],
    ["Baterai awal", summary.battery_start === null ? "-" : `${fmtNumber(summary.battery_start, 0)} %`],
    ["Baterai akhir", summary.battery_end === null ? "-" : `${fmtNumber(summary.battery_end, 0)} %`],
    ["Titik GPS", String(summary.points)],
    ["Titik drop", `${dropInfo.count} (${dropInfo.located} berkoordinat)`],
  ];
}

function dropRows(drops: DropRecord[]): Cell[][] {
  return [
    ["Waktu", "Latitude", "Longitude", "Thrust (%)", "Durasi (s)"],
    ...drops.map((drop) => [
      timeText(drop.time * 1000),
      drop.lat === null ? "-" : drop.lat.toFixed(6),
      drop.lon === null ? "-" : drop.lon.toFixed(6),
      drop.thrust,
      drop.duration,
    ]),
  ];
}

function pathRows(history: TelemetrySample[]): Cell[][] {
  const points = flightPathFromHistory(history);
  return [
    ["No", "Waktu", "Latitude", "Longitude", "Ketinggian (m)", "Kecepatan (m/s)"],
    ...points.map((point, index) => [
      index + 1,
      timeText(point.time),
      point.lat.toFixed(6),
      point.lon.toFixed(6),
      point.alt === null ? "-" : point.alt.toFixed(1),
      point.speed === null ? "-" : point.speed.toFixed(1),
    ]),
  ];
}

export function exportFlightExcel(history: TelemetrySample[], drops: DropRecord[]): void {
  const points = flightPathFromHistory(history);
  const summary = summarizeFlight(points, history, drops);
  const validDrops = drops.filter((drop): drop is DropRecord & { lat: number; lon: number } => drop.lat !== null && drop.lon !== null);

  downloadWorkbook(
    [
      { name: "Ringkasan", rows: [["Parameter", "Nilai"], ...summaryRows(summary, drops)] },
      { name: "Jalur", rows: pathRows(history) },
      { name: "Titik Drop", rows: dropRows(drops) },
      { name: "Koordinat Drop", rows: [["Waktu", "Latitude", "Longitude"], ...validDrops.map((drop) => [timeText(drop.time * 1000), drop.lat.toFixed(6), drop.lon.toFixed(6)])] },
    ],
    `jalur-terbang-${fileStamp()}.xlsx`,
  );
}

export function exportFlightPdf(history: TelemetrySample[], drops: DropRecord[]): void {
  const allPoints = flightPathFromHistory(history);
  const summary = summarizeFlight(allPoints, history, drops);
  const points = sampledPoints(allPoints, 400);
  const tablePoints = sampledPoints(allPoints, 150);
  const validDrops = drops.filter((drop): drop is DropRecord & { lat: number; lon: number } => drop.lat !== null && drop.lon !== null);

  const report: PdfReport = {
    title: "Laporan Jalur Terbang",
    subtitle: "Drone Command Center - telemetri Pixhawk via MQTT",
    summary: summaryRows(summary, drops),
    charts: [
      { type: "path", title: "Peta jalur (lat/lon)", lat: points.map((p) => p.lat), lon: points.map((p) => p.lon), points: validDrops },
      {
        type: "line",
        title: "Profil ketinggian",
        unit: "m",
        labels: points.map((p) => new Date(p.time).toLocaleTimeString("id-ID", { hour12: false })),
        series: [{ label: "Ketinggian", color: CYAN, values: points.map((p) => p.alt) }],
      },
    ],
    tables: [
      {
        title: tablePoints.length < allPoints.length ? `Titik jalur (${tablePoints.length} dari ${allPoints.length})` : `Titik jalur (${allPoints.length})`,
        head: ["No", "Waktu", "Latitude", "Longitude", "Alt (m)", "Speed (m/s)"],
        body: tablePoints.map((point, index) => [
          index + 1,
          timeText(point.time),
          point.lat.toFixed(6),
          point.lon.toFixed(6),
          point.alt === null ? "-" : point.alt.toFixed(1),
          point.speed === null ? "-" : point.speed.toFixed(1),
        ]),
      },
    ],
    footnote: "Sumber: telemetri live Drone Command Center. Jalur diambil dari riwayat posisi GPS pada sesi ini.",
  };

  if (drops.length > 0) {
    report.tables?.push({
      title: "Titik drop",
      head: ["Waktu", "Latitude", "Longitude", "Thrust (%)", "Durasi (s)"],
      body: drops.map((drop) => [timeText(drop.time * 1000), coordText(drop.lat, drop.lon), String(drop.thrust), String(drop.duration)]),
    });
  }

  downloadPdf(report, `jalur-terbang-${fileStamp()}.pdf`);
}

export function exportDropsExcel(drops: DropRecord[]): void {
  const summary = summarizeDrops(drops);
  const buckets = dropBuckets(drops);
  downloadWorkbook(
    [
      {
        name: "Ringkasan",
        rows: [
          ["Parameter", "Nilai"],
          ["Total drop", summary.count],
          ["Drop berkoordinat", summary.located],
          ["Rata-rata thrust (%)", summary.avg_thrust === null ? "-" : summary.avg_thrust.toFixed(1)],
          ["Total durasi (s)", summary.total_duration_s.toFixed(1)],
          ["Drop pertama", timeText(summary.first === null ? null : summary.first * 1000)],
          ["Drop terakhir", timeText(summary.last === null ? null : summary.last * 1000)],
        ],
      },
      { name: "Per Interval", rows: [["Interval", "Jumlah"], ...buckets.map((bucket) => [bucket.label, bucket.value])] },
      { name: "Titik Drop", rows: dropRows(drops) },
    ],
    `riwayat-drop-${fileStamp()}.xlsx`,
  );
}

export function exportDropsPdf(drops: DropRecord[]): void {
  const summary = summarizeDrops(drops);
  const buckets = dropBuckets(drops);
  downloadPdf(
    {
      title: "Laporan Riwayat Drop",
      subtitle: "Drone Command Center - titik drop benih",
      summary: [
        ["Total drop", String(summary.count)],
        ["Drop berkoordinat", String(summary.located)],
        ["Rata-rata thrust", summary.avg_thrust === null ? "-" : `${summary.avg_thrust.toFixed(1)} %`],
        ["Total durasi", `${summary.total_duration_s.toFixed(1)} s`],
        ["Drop pertama", timeText(summary.first === null ? null : summary.first * 1000)],
        ["Drop terakhir", timeText(summary.last === null ? null : summary.last * 1000)],
      ],
      charts: buckets.length > 0
        ? [
            {
              type: "line",
              title: "Distribusi drop per interval",
              labels: buckets.map((bucket) => bucket.label),
              series: [{ label: "Jumlah drop", color: AMBER, values: buckets.map((bucket) => bucket.value) }],
            },
          ]
        : undefined,
      tables: [
        {
          title: `Titik drop (${drops.length})`,
          head: ["Waktu", "Latitude", "Longitude", "Thrust (%)", "Durasi (s)"],
          body: drops.map((drop) => [timeText(drop.time * 1000), coordText(drop.lat, drop.lon), String(drop.thrust), String(drop.duration)]),
        },
      ],
      footnote: "Sumber: riwayat drop dari backend Drone Command Center.",
    },
    `riwayat-drop-${fileStamp()}.pdf`,
  );
}

function batteryRows(history: TelemetrySample[], battery: BatteryStatus | null | undefined): Cell[][] {
  const rows: Cell[][] = [
    ["Waktu", "Tegangan (V)", "Arus (A)", "Baterai (%)"],
    ...history.map((sample) => [
      timeText(sample.time),
      sample.voltage === null ? "-" : sample.voltage.toFixed(2),
      sample.current === null ? "-" : sample.current.toFixed(2),
      sample.battery === null ? "-" : sample.battery.toFixed(1),
    ]),
  ];
  if (battery) {
    rows.push([]);
    rows.push(["Kapasitas (mAh)", battery.capacity_mah]);
    rows.push(["Terpakai (mAh)", battery.used_mah]);
    rows.push(["Sisa (mAh)", battery.remaining_mah]);
    rows.push(["Estimasi sisa waktu", fmtMinutes(battery.estimated_minutes_left)]);
  }
  return rows;
}

export function exportBatteryExcel(history: TelemetrySample[], battery: BatteryStatus | null | undefined): void {
  const summary = summarizeFlight(flightPathFromHistory(history), history, []);
  downloadWorkbook(
    [
      {
        name: "Ringkasan",
        rows: [
          ["Parameter", "Nilai"],
          ["Mulai", timeText(summary.start)],
          ["Selesai", timeText(summary.end)],
          ["Durasi", fmtDuration(summary.duration_s)],
          ["Baterai awal", summary.battery_start === null ? "-" : `${summary.battery_start.toFixed(0)} %`],
          ["Baterai akhir", summary.battery_end === null ? "-" : `${summary.battery_end.toFixed(0)} %`],
          ["Kapasitas (mAh)", battery?.capacity_mah ?? "-"],
          ["Sisa (mAh)", battery?.remaining_mah ?? "-"],
          ["Arus rata-rata (A)", battery?.avg_current === null || battery?.avg_current === undefined ? "-" : battery.avg_current.toFixed(2)],
          ["Estimasi sisa waktu", fmtMinutes(battery?.estimated_minutes_left ?? null)],
        ],
      },
      { name: "Riwayat", rows: batteryRows(history, battery) },
    ],
    `baterai-${fileStamp()}.xlsx`,
  );
}

export function exportBatteryPdf(history: TelemetrySample[], battery: BatteryStatus | null | undefined): void {
  const points = sampledPoints(flightPathFromHistory(history), 300);
  const sampled = history.length > 300 ? history.filter((_, index) => index % Math.ceil(history.length / 300) === 0) : history;
  const labels = sampled.map((sample) => new Date(sample.time).toLocaleTimeString("id-ID", { hour12: false }));

  downloadPdf(
    {
      title: "Laporan Baterai",
      subtitle: "Drone Command Center - tegangan, arus, dan sisa daya",
      summary: [
        ["Tegangan", `${fmtNumber(history[history.length - 1]?.voltage ?? null, 2)} V`],
        ["Arus", `${fmtNumber(history[history.length - 1]?.current ?? null)} A`],
        ["Sisa baterai", `${fmtNumber(history[history.length - 1]?.battery ?? null, 0)} %`],
        ["Kapasitas", `${fmtNumber(battery?.capacity_mah ?? null, 0)} mAh`],
        ["Sisa kapasitas", `${fmtNumber(battery?.remaining_mah ?? null, 0)} mAh`],
        ["Arus rata-rata", `${fmtNumber(battery?.avg_current ?? null)} A`],
        ["Estimasi sisa waktu", fmtMinutes(battery?.estimated_minutes_left ?? null)],
        ["Sampel", String(history.length)],
      ],
      charts: [
        {
          type: "line",
          title: "Sisa baterai (%)",
          unit: "%",
          labels,
          series: [{ label: "Baterai", color: GREEN, values: sampled.map((sample) => sample.battery) }],
        },
        {
          type: "line",
          title: "Tegangan (V) dan arus (A)",
          labels,
          series: [
            { label: "Tegangan", color: CYAN, values: sampled.map((sample) => sample.voltage) },
            { label: "Arus", color: AMBER, values: sampled.map((sample) => sample.current) },
          ],
        },
      ],
      tables: [
        {
          title: `Riwayat telemetri (${sampled.length} dari ${history.length})`,
          head: ["Waktu", "Tegangan (V)", "Arus (A)", "Baterai (%)"],
          body: sampled.map((sample) => [
            timeText(sample.time),
            sample.voltage === null ? "-" : sample.voltage.toFixed(2),
            sample.current === null ? "-" : sample.current.toFixed(2),
            sample.battery === null ? "-" : sample.battery.toFixed(1),
          ]),
        },
      ],
      footnote: `Jarak tempuh sesi: ${fmtNumber(summarizeFlight(points, history, []).distance_km, 3)} km. Sumber: telemetri MQTT Pixhawk.`,
    },
    `baterai-${fileStamp()}.pdf`,
  );
}

export function exportSeedExcel(seed: SeedStatus | null | undefined, history: TelemetrySample[]): void {
  const summary = summarizeFlight(flightPathFromHistory(history), history, []);
  downloadWorkbook(
    [
      {
        name: "Benih",
        rows: [
          ["Parameter", "Nilai"],
          ["Dimuat", seed?.loaded ?? "-"],
          ["Sudah di-drop", seed?.dropped ?? "-"],
          ["Sisa", seed?.remaining ?? "-"],
          ["Waktu ekspor", fmtDateTime(Date.now() / 1000)],
          ["Jarak sesi (km)", summary.distance_km.toFixed(3)],
          ["Titik GPS", summary.points],
        ],
      },
    ],
    `benih-${fileStamp()}.xlsx`,
  );
}

export function exportSeedPdf(seed: SeedStatus | null | undefined, history: TelemetrySample[]): void {
  const summary = summarizeFlight(flightPathFromHistory(history), history, []);
  downloadPdf(
    {
      title: "Laporan Benih",
      subtitle: "Drone Command Center - status penebaran benih",
      summary: [
        ["Dimuat", String(seed?.loaded ?? "-")],
        ["Sudah di-drop", String(seed?.dropped ?? "-")],
        ["Sisa", String(seed?.remaining ?? "-")],
        ["Waktu ekspor", fmtDateTime(Date.now() / 1000)],
        ["Jarak sesi", `${fmtNumber(summary.distance_km, 3)} km`],
        ["Titik GPS", String(summary.points)],
      ],
      charts: summary.points > 1
        ? [
            {
              type: "line",
              title: "Profil ketinggian saat penebaran",
              unit: "m",
              series: [{ label: "Ketinggian", color: CYAN, values: sampledPoints(flightPathFromHistory(history), 300).map((point) => point.alt) }],
            },
          ]
        : undefined,
      footnote: "Sumber: status benih dan telemetri Drone Command Center.",
    },
    `benih-${fileStamp()}.pdf`,
  );
}
