/**
 * Server-side PDF for report snapshot (same figures as /api/reports/snapshot).
 */
import { PDFDocument, StandardFonts } from "pdf-lib";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const LINE = 14;
const SIZE = 10;

export async function buildSnapshotPdf(snapshot) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  function ensureSpace() {
    if (y < MARGIN + LINE) {
      page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function line(text) {
    const s = String(text).replace(/[^\x20-\x7E]/g, "?");
    ensureSpace();
    page.drawText(s, { x: MARGIN, y: y - SIZE, size: SIZE, font });
    y -= LINE;
  }

  line("Theme Park — cross-portal report snapshot");
  line(`Generated (UTC): ${new Date().toISOString()}`);
  line("");
  line("--- KPIs ---");
  line(`Visitors (total): ${snapshot.visitorsTotal}`);
  line(`Visitors (active): ${snapshot.visitorsActive}`);
  line(`Tickets issued: ${snapshot.ticketsTotal}`);
  line(`Tickets active: ${snapshot.ticketsActive}`);
  line(`Retail transactions: ${snapshot.retailTxCount}`);
  line(`Retail revenue (sum): ${Number(snapshot.retailRevenue).toFixed(2)}`);
  line(`Incidents (window ${snapshot.incidentsWindowDays}d): ${snapshot.incidentsInWindow}`);
  line(`Visitor reviews (all time): ${snapshot.visitorReviewsTotal}`);
  line(`Visitor reviews (window ${snapshot.visitorReviewsWindowDays}d): ${snapshot.visitorReviewsInWindow}`);
  const avg =
    snapshot.visitorReviewsAvgInWindow != null && Number.isFinite(Number(snapshot.visitorReviewsAvgInWindow))
      ? Number(snapshot.visitorReviewsAvgInWindow).toFixed(2)
      : "n/a";
  line(`Avg rating (window, 1-10): ${avg}`);

  line("");
  line("--- KPI alerts ---");
  if (Array.isArray(snapshot.kpiAlerts) && snapshot.kpiAlerts.length) {
    for (const a of snapshot.kpiAlerts) {
      line(`[${a.severity}] ${String(a.message).replace(/[^\x20-\x7E]/g, "?")}`);
    }
  } else {
    line("None (thresholds not set or not breached).");
  }

  line("");
  line("--- Note ---");
  line("Use CSV exports in the portal for row-level detail.");

  return Buffer.from(await pdfDoc.save());
}
