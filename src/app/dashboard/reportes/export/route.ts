import type { NextRequest } from "next/server";
import { buildReport, type Report } from "@/lib/data/reports";
import { addDays, fromDayKey, startOfDay } from "@/lib/dates";
import { getShop } from "@/lib/data/queries";

/**
 * Exportación de reportes: GET ?format=xlsx|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Los archivos se generan EN EL SERVIDOR (exceljs / jspdf): el navegador solo
 * recibe la descarga. Así el bundle del cliente no carga librerías pesadas y
 * la CSP estricta queda intacta. Los imports son dinámicos para que Next solo
 * los evalúe cuando de verdad se exporta.
 */

const MAX_RANGE_DAYS = 366;

const money = (cents: number) => cents / 100;
const fmtMoney = (cents: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(cents / 100);

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const format = params.get("format");
  if (format !== "xlsx" && format !== "pdf") {
    return new Response("Formato inválido. Usa ?format=xlsx o ?format=pdf.", {
      status: 400,
    });
  }

  const today = startOfDay(new Date());
  let from = fromDayKey(params.get("from")) ?? addDays(today, -29);
  let to = fromDayKey(params.get("to")) ?? today;
  if (to < from) [from, to] = [to, from];
  if ((to.getTime() - from.getTime()) / 86400000 > MAX_RANGE_DAYS) {
    return new Response("Rango demasiado grande (máx. 1 año).", { status: 400 });
  }

  const [shop, report] = await Promise.all([getShop(), buildReport(from, to)]);
  const filename = `navaja-reporte_${report.fromKey}_${report.toKey}.${format}`;

  const body =
    format === "xlsx" ? await toXlsx(shop.name, report) : await toPdf(shop.name, report);

  return new Response(body, {
    headers: {
      "Content-Type":
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/* ------------------------------------------------------------------ *
 * Excel (exceljs)
 * ------------------------------------------------------------------ */
async function toXlsx(shopName: string, r: Report): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Navaja";

  const header = (ws: import("exceljs").Worksheet) => {
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1C1917" },
    };
  };
  const moneyFmt = '"$"#,##0';

  // --- Resumen -------------------------------------------------------------
  const resumen = wb.addWorksheet("Resumen");
  resumen.columns = [{ width: 34 }, { width: 22 }];
  resumen.addRows([
    ["Barbería", shopName],
    ["Periodo", `${r.fromKey} a ${r.toKey} (${r.days} días)`],
    [],
    ["Citas totales", r.totals.appointments],
    ["Completadas", r.totals.completed],
    ["Confirmadas", r.totals.confirmed],
    ["Pendientes", r.totals.pending],
    ["Canceladas", r.totals.cancelled],
    ["No asistió", r.totals.noShow],
    [],
    ["Ingresos (completadas)", money(r.totals.revenueCents)],
    ["Proyectado (por atender)", money(r.totals.projectedCents)],
    ["Ticket promedio", money(r.totals.avgTicketCents)],
    [],
    ["Clientes únicos", r.totals.uniqueClients],
    ["Ocupación", `${r.totals.occupancyPct}%`],
    ["Tasa de no-show", `${r.totals.noShowRatePct}%`],
    ["Tasa de cancelación", `${r.totals.cancelRatePct}%`],
  ]);
  resumen.getColumn(1).font = { bold: true };
  [11, 12, 13].forEach((row) => (resumen.getCell(`B${row}`).numFmt = moneyFmt));

  // --- Por servicio ----------------------------------------------------------
  const svc = wb.addWorksheet("Por servicio");
  svc.columns = [
    { header: "Servicio", key: "name", width: 28 },
    { header: "Citas", key: "count", width: 10 },
    { header: "Ingresos", key: "rev", width: 14 },
    { header: "% ingresos", key: "share", width: 12 },
  ];
  r.byService.forEach((row) =>
    svc.addRow({
      name: row.name,
      count: row.count,
      rev: money(row.revenueCents),
      share: `${row.sharePct}%`,
    }),
  );
  svc.getColumn("rev").numFmt = moneyFmt;
  header(svc);

  // --- Por barbero -----------------------------------------------------------
  const brb = wb.addWorksheet("Por barbero");
  brb.columns = [
    { header: "Barbero", key: "name", width: 28 },
    { header: "Citas", key: "count", width: 10 },
    { header: "Ingresos", key: "rev", width: 14 },
    { header: "% ingresos", key: "share", width: 12 },
  ];
  r.byBarber.forEach((row) =>
    brb.addRow({
      name: row.name,
      count: row.count,
      rev: money(row.revenueCents),
      share: `${row.sharePct}%`,
    }),
  );
  brb.getColumn("rev").numFmt = moneyFmt;
  header(brb);

  // --- Por día y hora ----------------------------------------------------------
  const tiempo = wb.addWorksheet("Por día y hora");
  tiempo.columns = [
    { header: "Día de la semana", key: "d", width: 20 },
    { header: "Citas", key: "c", width: 10 },
    { header: "Ingresos", key: "r", width: 14 },
    { header: "", key: "sep", width: 4 },
    { header: "Hora", key: "h", width: 10 },
    { header: "Citas", key: "hc", width: 10 },
  ];
  const rows = Math.max(r.byWeekday.length, r.byHour.length);
  for (let i = 0; i < rows; i++) {
    tiempo.addRow({
      d: r.byWeekday[i]?.label ?? "",
      c: r.byWeekday[i]?.count ?? "",
      r: r.byWeekday[i] ? money(r.byWeekday[i].revenueCents) : "",
      h: r.byHour[i] ? `${pad(r.byHour[i].hour)}:00` : "",
      hc: r.byHour[i]?.count ?? "",
    });
  }
  tiempo.getColumn("r").numFmt = moneyFmt;
  header(tiempo);

  // --- Top clientes ------------------------------------------------------------
  const cli = wb.addWorksheet("Top clientes");
  cli.columns = [
    { header: "Cliente", key: "name", width: 28 },
    { header: "Teléfono", key: "phone", width: 20 },
    { header: "Visitas", key: "count", width: 10 },
    { header: "Gasto", key: "rev", width: 14 },
  ];
  r.topClients.forEach((c) =>
    cli.addRow({
      name: c.name,
      phone: c.phone,
      count: c.count,
      rev: money(c.revenueCents),
    }),
  );
  cli.getColumn("rev").numFmt = moneyFmt;
  header(cli);

  // --- Detalle -------------------------------------------------------------------
  const det = wb.addWorksheet("Detalle de citas");
  det.columns = [
    { header: "Fecha", key: "date", width: 12 },
    { header: "Hora", key: "time", width: 8 },
    { header: "Cliente", key: "client", width: 26 },
    { header: "Servicio", key: "service", width: 24 },
    { header: "Barbero", key: "barber", width: 22 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Precio", key: "price", width: 12 },
  ];
  r.rows.forEach((a) =>
    det.addRow({
      date: fmtDate(a.start),
      time: fmtTime(a.start),
      client: a.client.name,
      service: a.service.name,
      barber: a.barber.name,
      status: a.status,
      price: money(a.priceCents),
    }),
  );
  det.getColumn("price").numFmt = moneyFmt;
  header(det);
  det.autoFilter = { from: "A1", to: "G1" };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/* ------------------------------------------------------------------ *
 * PDF (jspdf + autotable)
 * ------------------------------------------------------------------ */
async function toPdf(shopName: string, r: Report): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF();
  const gold: [number, number, number] = [161, 98, 7];
  const ink: [number, number, number] = [28, 25, 23];

  doc.setFontSize(20).setTextColor(...ink).setFont("helvetica", "bold");
  doc.text("Navaja — Reporte", 14, 18);
  doc.setFontSize(11).setFont("helvetica", "normal").setTextColor(120);
  doc.text(`${shopName} · ${r.fromKey} a ${r.toKey} (${r.days} días)`, 14, 25);

  const tableDefaults = {
    styles: { fontSize: 9 },
    headStyles: { fillColor: ink, textColor: 255 },
    margin: { left: 14, right: 14 },
  } as const;

  autoTable(doc, {
    ...tableDefaults,
    startY: 32,
    head: [["Indicador", "Valor", "Indicador", "Valor"]],
    body: [
      ["Citas totales", String(r.totals.appointments), "Ingresos", fmtMoney(r.totals.revenueCents)],
      ["Completadas", String(r.totals.completed), "Proyectado", fmtMoney(r.totals.projectedCents)],
      ["Confirmadas", String(r.totals.confirmed), "Ticket promedio", fmtMoney(r.totals.avgTicketCents)],
      ["Pendientes", String(r.totals.pending), "Clientes únicos", String(r.totals.uniqueClients)],
      ["Canceladas", String(r.totals.cancelled), "Ocupación", `${r.totals.occupancyPct}%`],
      ["No asistió", String(r.totals.noShow), "Tasa no-show", `${r.totals.noShowRatePct}%`],
    ],
  });

  const section = (title: string, head: string[], body: (string | number)[][]) => {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    doc.setFontSize(13).setTextColor(...gold).setFont("helvetica", "bold");
    doc.text(title, 14, y + 12);
    autoTable(doc, { ...tableDefaults, startY: y + 16, head: [head], body });
  };

  section(
    "Por servicio",
    ["Servicio", "Citas", "Ingresos", "% ingresos"],
    r.byService.map((s) => [s.name, s.count, fmtMoney(s.revenueCents), `${s.sharePct}%`]),
  );
  section(
    "Por barbero",
    ["Barbero", "Citas", "Ingresos", "% ingresos"],
    r.byBarber.map((b) => [b.name, b.count, fmtMoney(b.revenueCents), `${b.sharePct}%`]),
  );
  section(
    "Por día de la semana",
    ["Día", "Citas", "Ingresos"],
    r.byWeekday.map((d) => [d.label, d.count, fmtMoney(d.revenueCents)]),
  );
  section(
    "Estados",
    ["Estado", "Citas", "%"],
    r.byStatus.map((s) => [s.label, s.count, `${s.pct}%`]),
  );
  section(
    "Top clientes",
    ["Cliente", "Teléfono", "Visitas", "Gasto"],
    r.topClients.map((c) => [c.name, c.phone, c.count, fmtMoney(c.revenueCents)]),
  );

  // Detalle acotado: el PDF es para leer; el detalle completo vive en Excel.
  const MAX_DETAIL = 150;
  section(
    r.rows.length > MAX_DETAIL
      ? `Detalle de citas (primeras ${MAX_DETAIL} de ${r.rows.length} — completo en Excel)`
      : "Detalle de citas",
    ["Fecha", "Hora", "Cliente", "Servicio", "Barbero", "Estado", "Precio"],
    r.rows
      .slice(0, MAX_DETAIL)
      .map((a) => [
        fmtDate(a.start),
        fmtTime(a.start),
        a.client.name,
        a.service.name,
        a.barber.name,
        a.status,
        fmtMoney(a.priceCents),
      ]),
  );

  return doc.output("arraybuffer");
}
