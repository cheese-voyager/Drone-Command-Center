import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export type Cell = string | number | null;
export interface SheetSpec {
  name: string;
  rows: Cell[][];
}

export interface PdfLineSeries {
  label: string;
  color: [number, number, number];
  values: (number | null)[];
}

export type PdfChart =
  | { type: "line"; title: string; unit?: string; labels?: string[]; series: PdfLineSeries[] }
  | { type: "path"; title: string; lat: number[]; lon: number[]; points?: { lat: number; lon: number; label?: string }[] };

export interface PdfTable {
  title?: string;
  head: string[];
  body: (string | number)[][];
}

export interface PdfReport {
  title: string;
  subtitle?: string;
  summary?: [string, string][];
  charts?: PdfChart[];
  tables?: PdfTable[];
  footnote?: string;
}

type PdfWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function fileStamp(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadWorkbook(sheets: SheetSpec[], filename: string): void {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
    const widths = sheet.rows[0]?.map((_, index) => {
      const longest = sheet.rows.reduce((max, row) => {
        const text = row[index] === null || row[index] === undefined ? "" : String(row[index]);
        return Math.max(max, text.length);
      }, 6);
      return { wch: Math.min(42, longest + 2) };
    });
    if (widths) ws["!cols"] = widths;
    XLSX.utils.book_append_sheet(workbook, ws, sheet.name.slice(0, 31));
  }
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

function drawLineChart(doc: jsPDF, chart: Extract<PdfChart, { type: "line" }>, x: number, y: number, w: number, h: number): void {
  const finite = chart.series.flatMap((item) => item.values.filter((value): value is number => value !== null && Number.isFinite(value)));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(chart.title, x, y - 2);

  if (finite.length < 2) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Belum ada data", x + 2, y + h / 2);
    return;
  }

  const rawMax = Math.max(...finite);
  const rawMin = Math.min(...finite);
  const padding = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.12;
  const max = rawMax + padding;
  const min = Math.max(0, rawMin - padding);
  const span = max - min || 1;

  doc.setDrawColor(225, 230, 235);
  doc.setLineWidth(0.2);
  for (let i = 0; i <= 4; i += 1) {
    const gy = y + (h / 4) * i;
    doc.line(x, gy, x + w, gy);
  }

  for (const item of chart.series) {
    doc.setDrawColor(item.color[0], item.color[1], item.color[2]);
    doc.setLineWidth(0.5);
    let previous: { x: number; y: number } | null = null;
    const values = item.values;
    values.forEach((value, index) => {
      if (value === null || !Number.isFinite(value)) {
        previous = null;
        return;
      }
      const px = x + (index / Math.max(1, values.length - 1)) * w;
      const py = y + h - ((value - min) / span) * h;
      if (previous) doc.line(previous.x, previous.y, px, py);
      previous = { x: px, y: py };
    });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 120);
  const unit = chart.unit ? ` ${chart.unit}` : "";
  doc.text(`${rawMax.toFixed(1)}${unit}`, x + 1, y + 3);
  doc.text(`${rawMin.toFixed(1)}${unit}`, x + 1, y + h - 1);
  if (chart.labels && chart.labels.length > 1) {
    doc.text(String(chart.labels[0]), x, y + h + 4);
    doc.text(String(chart.labels[chart.labels.length - 1]), x + w, y + h + 4, { align: "right" });
  }

  let legendX = x;
  for (const item of chart.series) {
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.rect(legendX, y + h + 6.5, 2, 2, "F");
    doc.setTextColor(80, 80, 80);
    doc.text(item.label, legendX + 3, y + h + 8.2);
    legendX += doc.getTextWidth(item.label) + 10;
  }
}

function drawPathChart(doc: jsPDF, chart: Extract<PdfChart, { type: "path" }>, x: number, y: number, w: number, h: number): void {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text(chart.title, x, y - 2);

  if (chart.lat.length < 2) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("Belum ada data jalur", x + 2, y + h / 2);
    return;
  }

  const minLat = Math.min(...chart.lat);
  const maxLat = Math.max(...chart.lat);
  const minLon = Math.min(...chart.lon);
  const maxLon = Math.max(...chart.lon);
  const spanLat = maxLat - minLat || 0.0001;
  const spanLon = maxLon - minLon || 0.0001;

  doc.setDrawColor(210, 220, 230);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);

  doc.setDrawColor(15, 130, 140);
  doc.setLineWidth(0.6);
  let previous: { x: number; y: number } | null = null;
  chart.lat.forEach((lat, index) => {
    const px = x + ((chart.lon[index] - minLon) / spanLon) * w;
    const py = y + h - ((lat - minLat) / spanLat) * h;
    if (previous) doc.line(previous.x, previous.y, px, py);
    previous = { x: px, y: py };
  });

  const startX = x;
  const startY = y + h - ((chart.lat[0] - minLat) / spanLat) * h;
  doc.setFillColor(61, 220, 151);
  doc.circle(startX, startY, 0.9, "F");

  for (const point of chart.points ?? []) {
    const px = x + ((point.lon - minLon) / spanLon) * w;
    const py = y + h - ((point.lat - minLat) / spanLat) * h;
    doc.setFillColor(255, 69, 96);
    doc.circle(px, py, 0.8, "F");
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 110, 120);
  doc.text(`${maxLat.toFixed(5)}, ${maxLon.toFixed(5)}`, x + 1, y + 3);
  doc.text(`${minLat.toFixed(5)}, ${minLon.toFixed(5)}`, x + 1, y + h - 1);
}

export function downloadPdf(report: PdfReport, filename: string): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as PdfWithTable;
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(10, 20, 30);
  doc.text(report.title, margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 110, 120);
  if (report.subtitle) {
    doc.text(report.subtitle, margin, y);
    y += 5;
  }
  doc.text(`Dibuat: ${new Date().toLocaleString("id-ID")}`, margin, y);
  y += 7;

  if (report.summary && report.summary.length > 0) {
    doc.setFontSize(8.5);
    const columnWidth = (pageWidth - margin * 2) / 2;
    report.summary.forEach((entry, index) => {
      const column = index % 2;
      if (index > 0 && column === 0) y += 5;
      const x = margin + column * columnWidth;
      doc.setTextColor(100, 110, 120);
      doc.text(entry[0], x, y);
      doc.setTextColor(20, 30, 40);
      doc.text(entry[1], x + 42, y);
    });
    y += 8;
  }

  for (const chart of report.charts ?? []) {
    const height = 44;
    if (y + height + 10 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = 20;
    }
    if (chart.type === "line") drawLineChart(doc, chart, margin, y, pageWidth - margin * 2, height);
    else drawPathChart(doc, chart, margin, y, pageWidth - margin * 2, height);
    y += height + 12;
  }

  for (const table of report.tables ?? []) {
    if (y + 16 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = 20;
    }
    if (table.title) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(20, 30, 40);
      doc.text(table.title, margin, y);
      y += 3;
    }
    autoTable(doc, {
      startY: y,
      head: [table.head],
      body: table.body,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7.5, cellPadding: 1.4, textColor: [30, 40, 50], lineColor: [220, 226, 232] },
      headStyles: { fillColor: [15, 25, 38], textColor: [230, 242, 251], fontSize: 7.5 },
      alternateRowStyles: { fillColor: [246, 249, 252] },
      theme: "grid",
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  if (report.footnote) {
    if (y + 12 > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 130);
    doc.text(report.footnote, margin, y, { maxWidth: pageWidth - margin * 2 });
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(140, 150, 160);
    doc.text("Drone Command Center", margin, doc.internal.pageSize.getHeight() - 7);
    doc.text(`Halaman ${page} / ${pages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 7, { align: "right" });
  }

  doc.save(filename);
}
