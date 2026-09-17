/**
 * PDF generation utilities for Sravantix documents.
 * All documents are generated client-side using jsPDF.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Brand colours (RGB) ───────────────────────────────────────────────────────
const GREEN: [number, number, number] = [26, 100, 77];   // primary green
const DARK: [number, number, number] = [30, 36, 55];     // sidebar dark
const MUTED: [number, number, number] = [120, 120, 130];
const GOLD: [number, number, number] = [180, 140, 60];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatInr(amount: number): string {
  return "Rs. " + new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function addLetterhead(doc: jsPDF, title: string) {
  const W = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 24, "F");

  // Company name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("MIGHTY HOMES", 14, 12);

  // Gold underline accent
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.8);
  doc.line(14, 14.5, 68, 14.5);

  // Tagline
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 200, 195);
  doc.text("Real Estate Developer  ·  Mighty Yuva, Kannamangala, Bangalore", 14, 20);

  // Document title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...GREEN);
  doc.text(title, 14, 36);

  // Divider
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.line(14, 39, W - 14, 39);

  return 44; // next Y
}

function addFooter(doc: jsPDF) {
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  // Stacked on separate lines so the address and print timestamp never collide on narrow pages.
  doc.text("Mighty Homes  ·  Flat No.414, 4th Floor, Mighty Marwel, Kannamangala, Bangalore – 560067", 14, H - 11);
  doc.text(`Printed on ${new Date().toLocaleString("en-IN")}`, 14, H - 6.5);
}

// Returns the number of lines the value wrapped to, so callers can adjust the next row's y-position.
function kv(doc: jsPDF, label: string, value: string, x: number, y: number, maxWidth?: number): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  if (maxWidth) {
    const lines = doc.splitTextToSize(value, maxWidth) as string[];
    doc.text(lines, x, y + 5);
    return lines.length;
  }
  doc.text(value, x, y + 5);
  return 1;
}

// ── Document 1: Booking Confirmation ─────────────────────────────────────────

export type BookingConfirmationData = {
  bookingDate: string;
  agreementValue: number;
  buyer: { name: string; phone: string; email?: string; pan?: string; address?: string };
  project: { name: string; location?: string; rera?: string };
  unit: { number: string; block?: string; configuration?: string; areaSqft?: number; floor?: number };
  receipts?: { date: string; amount: number; mode: string; reference?: string }[];
};

export function downloadBookingConfirmation(data: BookingConfirmationData) {
  const doc = new jsPDF();
  let y = addLetterhead(doc, "Booking Confirmation");
  const W = doc.internal.pageSize.getWidth();

  // Booking date row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Booking Date: ${formatDate(data.bookingDate)}`, W - 14, y, { align: "right" });
  y += 10;

  // ── Buyer section ──
  doc.setFillColor(245, 247, 246);
  doc.roundedRect(14, y, W - 28, 34, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text("BUYER DETAILS", 18, y + 7);

  kv(doc, "Name", data.buyer.name, 18, y + 15);
  kv(doc, "Phone", data.buyer.phone, 100, y + 15);
  if (data.buyer.pan) kv(doc, "PAN", data.buyer.pan, 18, y + 25);
  if (data.buyer.email) kv(doc, "Email", data.buyer.email, 100, y + 25);
  y += 40;

  // ── Unit section ──
  const hasUnitRow2 = !!(data.unit.configuration || data.unit.areaSqft);
  const unitBoxH = hasUnitRow2 ? 38 : 24;
  doc.setFillColor(240, 246, 244);
  doc.roundedRect(14, y, W - 28, unitBoxH, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GREEN);
  doc.text("UNIT DETAILS", 18, y + 7);

  kv(doc, "Project", data.project.name, 18, y + 15);
  kv(doc, "Unit No.", data.unit.number, 100, y + 15);
  if (data.unit.configuration && data.unit.areaSqft) {
    // Both present: configuration left, area right
    kv(doc, "Configuration", data.unit.configuration, 18, y + 28);
    kv(doc, "Area", `${data.unit.areaSqft.toLocaleString("en-IN")} sq ft`, 100, y + 28);
  } else if (data.unit.configuration) {
    kv(doc, "Configuration", data.unit.configuration, 18, y + 28);
  } else if (data.unit.areaSqft) {
    // Only area: put it in left column
    kv(doc, "Area", `${data.unit.areaSqft.toLocaleString("en-IN")} sq ft`, 18, y + 28);
  }
  y += unitBoxH + 6;

  // ── Agreement value ── label and amount on the same baseline
  doc.setFillColor(...GREEN);
  doc.roundedRect(14, y, W - 28, 16, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("AGREEMENT VALUE", 18, y + 11);
  doc.text(formatInr(data.agreementValue), W - 18, y + 11, { align: "right" });
  y += 23;

  // RERA note
  if (data.project.rera) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`RERA Registration: ${data.project.rera}`, 14, y);
    y += 8;
  }

  // ── Receipts / payments received ──
  if (data.receipts && data.receipts.length > 0) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...GREEN);
    doc.text("PAYMENTS RECEIVED", 14, y);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.3);
    doc.line(14, y + 1.5, W - 14, y + 1.5);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [[
        "Date",
        "Mode",
        "Reference",
        { content: "Amount", styles: { halign: "right" as const } },
      ]],
      body: data.receipts.map((r) => [
        formatDate(r.date),
        r.mode.toUpperCase(),
        r.reference ?? "—",
        { content: formatInr(r.amount), styles: { halign: "right" as const } },
      ]),
      foot: [[
        { content: "Total Received", colSpan: 3, styles: { fontStyle: "bold" as const } },
        {
          content: formatInr(data.receipts.reduce((s, r) => s + r.amount, 0)),
          styles: { fontStyle: "bold" as const, halign: "right" as const },
        },
      ]],
      styles: { fontSize: 9, font: "helvetica" },
      headStyles: { fillColor: GREEN, textColor: [255, 255, 255] as [number, number, number] },
      footStyles: { fillColor: [240, 246, 244] as [number, number, number], textColor: DARK },
      columnStyles: {
        0: { cellWidth: 27 },
        1: { cellWidth: 18 },
        2: { cellWidth: 87 },
        3: { cellWidth: 50, halign: "right" as const, overflow: "visible" as const },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  // Declaration
  y += 4;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const declaration = "This document confirms the booking of the above unit. The final sale deed will be executed as per the Agreement to Sell.";
  const lines = doc.splitTextToSize(declaration, W - 28) as string[];
  doc.text(lines, 14, y);

  addFooter(doc);
  doc.save(`booking-${data.buyer.name.replace(/\s+/g, "-")}-${data.unit.number}.pdf`);
}

// ── Document 2: Payment Demand Notice ────────────────────────────────────────

export type DemandNoticeData = {
  noticeDate: string;
  buyer: { name: string; phone: string; email?: string };
  project: { name: string; rera?: string };
  unit: { number: string; block?: string; configuration?: string };
  installments: { milestone: string; amount: number; dueDate?: string; status: string }[];
  totalDemanded: number;
  agreementValue: number;
  totalReceived: number;
};

export function downloadDemandNotice(data: DemandNoticeData) {
  const doc = new jsPDF();
  let y = addLetterhead(doc, "Payment Demand Notice");
  const W = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Notice Date: ${formatDate(data.noticeDate)}`, W - 14, y, { align: "right" });
  y += 8;

  // Addressee
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(`To,`, 14, y); y += 5;
  doc.setFont("helvetica", "bold");
  doc.text(data.buyer.name, 14, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Ph: ${data.buyer.phone}`, 14, y);
  if (data.buyer.email) doc.text(`Email: ${data.buyer.email}`, 70, y);
  y += 8;

  // Subject line
  doc.setFillColor(245, 247, 246);
  doc.roundedRect(14, y, W - 28, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...DARK);
  doc.text(
    `Re: Payment demand — ${data.project.name} · Unit ${data.unit.number}`,
    18, y + 7,
  );
  y += 18;

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  const body = `Dear ${data.buyer.name},\n\nThis is a formal demand notice for the payment of the following instalment(s) as per your Agreement to Sell for Unit ${data.unit.number} in ${data.project.name}. Kindly remit the amount(s) on or before the due date(s) mentioned below.`;
  const bodyLines = doc.splitTextToSize(body, W - 28) as string[];
  doc.text(bodyLines, 14, y);
  y += bodyLines.length * 5 + 4;

  // Instalments table
  autoTable(doc, {
    startY: y,
    head: [["Milestone", "Due Date", "Amount (₹)", "Status"]],
    body: data.installments.map((i) => [
      i.milestone,
      i.dueDate ? formatDate(i.dueDate) : "—",
      formatInr(i.amount),
      i.status.toUpperCase(),
    ]),
    foot: [["", "Total Demanded", formatInr(data.totalDemanded), ""]],
    theme: "grid",
    headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
    footStyles: { fillColor: [230, 240, 236], fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 2: { halign: "right" } },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Summary
  const colW = (W - 28) / 3;
  [
    ["Agreement Value", formatInr(data.agreementValue)],
    ["Received Till Date", formatInr(data.totalReceived)],
    ["Balance Outstanding", formatInr(data.agreementValue - data.totalReceived)],
  ].forEach(([label, val], i) => {
    kv(doc, label, val, 14 + i * colW, finalY);
  });

  if (data.project.rera) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`RERA: ${data.project.rera}`, 14, finalY + 18);
  }

  addFooter(doc);
  doc.save(`demand-${data.buyer.name.replace(/\s+/g, "-")}-${data.unit.number}.pdf`);
}

// ── Document 3: Payment Receipt ───────────────────────────────────────────────

export type ReceiptData = {
  receiptNumber: string;
  receiptDate: string;
  amount: number;
  paymentMode: string;
  chequeRef?: string;
  notes?: string;
  buyer: { name: string; phone: string; email?: string; pan?: string };
  project: { name: string; rera?: string };
  unit: { number: string; block?: string; configuration?: string };
  agreementValue: number;
  totalReceived: number;
  balanceOutstanding: number;
  milestone?: string;
};

export function downloadReceipt(data: ReceiptData) {
  const doc = new jsPDF({ format: "a5" });
  let y = addLetterhead(doc, "Payment Receipt");
  const W = doc.internal.pageSize.getWidth();

  // Receipt no and date
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Receipt No: ${data.receiptNumber}`, 14, y);
  doc.text(`Date: ${formatDate(data.receiptDate)}`, W - 14, y, { align: "right" });
  y += 10;

  // Big amount box
  doc.setFillColor(...GREEN);
  doc.roundedRect(14, y, W - 28, 22, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 230, 220);
  doc.text("AMOUNT RECEIVED", W / 2, y + 6, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(formatInr(data.amount), W / 2, y + 17, { align: "center" });
  y += 28;

  // Details grid
  const col2 = W / 2;
  kv(doc, "Received from", data.buyer.name, 14, y);
  kv(doc, "Payment mode", data.paymentMode.toUpperCase(), col2, y);
  y += 12;
  kv(doc, "Project", data.project.name, 14, y);
  kv(doc, "Unit", `${data.unit.number}${data.unit.block ? ` (Block ${data.unit.block})` : ""}`, col2, y);
  y += 12;
  if (data.milestone) {
    kv(doc, "Milestone", data.milestone, 14, y);
    y += 12;
  }
  if (data.chequeRef) {
    const lines = kv(doc, "Cheque / Ref No.", data.chequeRef, 14, y, W - 28);
    y += 12 + (lines - 1) * 4.5;
  }
  if (data.buyer.pan) {
    kv(doc, "PAN", data.buyer.pan, 14, y);
    y += 12;
  }

  // Balance summary
  y += 2;
  doc.setFillColor(245, 247, 246);
  doc.roundedRect(14, y, W - 28, 24, 2, 2, "F");
  kv(doc, "Agreement value", formatInr(data.agreementValue), 18, y + 7);
  kv(doc, "Total received (incl. this)", formatInr(data.totalReceived), 18, y + 15);
  kv(doc, "Balance outstanding", formatInr(data.balanceOutstanding), col2, y + 7);
  y += 30;

  if (data.notes) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Note: ${data.notes}`, 14, y);
  }

  addFooter(doc);
  doc.save(`receipt-${data.receiptNumber}-${data.buyer.name.replace(/\s+/g, "-")}.pdf`);
}
