"use node";

import escapeHtml from "escape-html";
import { Hercules } from "@usehercules/sdk";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api.js";

const hercules = new Hercules({
  apiKey: process.env.HERCULES_API_KEY!,
  apiVersion: "2025-12-09",
});

export const doSendEmail = internalAction({
  args: {
    emailType: v.union(v.literal("demand_notice"), v.literal("reminder"), v.literal("booking_confirmation")),
    buyerEmail: v.string(),
    buyerName: v.string(),
    buyerPhone: v.string(),
    projectName: v.string(),
    projectRera: v.optional(v.string()),
    unitNumber: v.string(),
    unitBlock: v.optional(v.string()),
    unitConfiguration: v.optional(v.string()),
    agreementValue: v.number(),
    totalReceived: v.number(),
    outstanding: v.number(),
    installments: v.array(v.object({
      milestone: v.string(),
      amount: v.number(),
      dueDate: v.optional(v.string()),
      status: v.union(v.literal("pending"), v.literal("demanded"), v.literal("paid")),
    })),
    installmentIds: v.array(v.id("paymentInstallments")),
    senderAddress: v.string(),
    senderName: v.string(),
    replyTo: v.optional(v.string()),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { subject, html, text } = buildEmail(args);

    const fromField = args.senderName
      ? `${args.senderName} <${args.senderAddress}>`
      : args.senderAddress;

    await hercules.email.send({
      from: fromField,
      to: args.buyerEmail,
      ...(args.replyTo ? { reply_to: args.replyTo } : {}),
      subject,
      html,
      text,
      tags: [
        { name: "email_type", value: args.emailType },
        {
          name: "project",
          value: args.projectName.replace(/[^a-zA-Z0-9_\-.@]/g, "_").slice(0, 100) || "project",
        },
      ],
    });

    // Stamp emailedAt on each installment (not for booking_confirmation)
    if (args.emailType !== "booking_confirmation" && args.installmentIds.length > 0) {
      await ctx.runMutation(internal.emails.markEmailed, {
        installmentIds: args.installmentIds,
      });
    }
  },
});

// ─── Email template builder ───────────────────────────────────────────────────

type BuildEmailArgs = {
  emailType: "demand_notice" | "reminder" | "booking_confirmation";
  buyerName: string;
  projectName: string;
  projectRera?: string;
  unitNumber: string;
  unitBlock?: string;
  unitConfiguration?: string;
  agreementValue: number;
  totalReceived: number;
  outstanding: number;
  installments: { milestone: string; amount: number; dueDate?: string; status: string }[];
  customMessage?: string;
};

function formatInr(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildEmail(args: BuildEmailArgs): { subject: string; html: string; text: string } {
  const name = escapeHtml(args.buyerName);
  const project = escapeHtml(args.projectName);
  const unit = escapeHtml(
    [
      args.unitConfiguration,
      args.unitBlock ? `Block ${args.unitBlock}` : null,
      `Unit ${args.unitNumber}`,
    ]
      .filter(Boolean)
      .join(" · "),
  );
  const rera = args.projectRera ? escapeHtml(args.projectRera) : null;

  const baseStyle = `font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a2e;`;
  const headerBg = `background:linear-gradient(135deg,#1B4332 0%,#2D6A4F 100%);padding:32px 40px;border-radius:12px 12px 0 0;`;
  const bodyBg = `background:#ffffff;padding:32px 40px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;`;

  const buildRows = (
    items: { milestone: string; amount: number; dueDate?: string }[],
  ) =>
    items
      .map(
        (i) =>
          `<tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;">${escapeHtml(i.milestone)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;">${fmtDate(i.dueDate)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${formatInr(i.amount)}</td>
          </tr>`,
      )
      .join("");

  const tableHtml = (
    rows: { milestone: string; amount: number; dueDate?: string }[],
  ) => `
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
      <thead>
        <tr style="background:#f8f9fa;">
          <th style="padding:10px 12px;text-align:left;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Milestone</th>
          <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Due Date</th>
          <th style="padding:10px 12px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0;">Amount</th>
        </tr>
      </thead>
      <tbody>${buildRows(rows)}</tbody>
      <tfoot>
        <tr style="background:#f8f9fa;font-weight:700;">
          <td style="padding:10px 12px;" colspan="2">Total</td>
          <td style="padding:10px 12px;text-align:right;">${formatInr(rows.reduce((s, i) => s + i.amount, 0))}</td>
        </tr>
      </tfoot>
    </table>`;

  const customBlock = args.customMessage
    ? `<div style="background:#f0fdf4;border-left:4px solid #2D6A4F;padding:14px 16px;border-radius:4px;margin-top:20px;font-size:14px;">${escapeHtml(args.customMessage)}</div>`
    : "";

  const footer = `
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
      <p style="margin:4px 0;">This is an automated email from Sravantix ERP.</p>
      ${rera ? `<p style="margin:4px 0;">RERA: ${rera}</p>` : ""}
    </div>`;

  if (args.emailType === "booking_confirmation") {
    const subject = `Booking Confirmation — ${args.projectName} · ${args.unitNumber}`;
    const html = `
      <div style="${baseStyle}">
        <div style="${headerBg}">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">Booking Confirmation</h1>
          <p style="color:#a7f3d0;margin:6px 0 0;font-size:14px;">${project} · ${unit}</p>
        </div>
        <div style="${bodyBg}">
          <p>Dear <strong>${name}</strong>,</p>
          <p>We are pleased to confirm your booking. Thank you for choosing us.</p>
          <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:16px;">
            <tr><td style="padding:8px 0;color:#64748b;">Project</td><td style="padding:8px 0;font-weight:600;">${project}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Unit</td><td style="padding:8px 0;font-weight:600;">${unit}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;">Agreement Value</td><td style="padding:8px 0;font-weight:600;">${formatInr(args.agreementValue)}</td></tr>
          </table>
          ${args.installments.length > 0 ? `<p style="font-weight:600;margin-top:24px;">Payment Schedule</p>${tableHtml(args.installments)}` : ""}
          ${customBlock}
          ${footer}
        </div>
      </div>`;
    const text = `Booking Confirmation\n\nDear ${args.buyerName},\n\nYour booking for ${args.projectName} · ${args.unitNumber} has been confirmed.\nAgreement Value: ${formatInr(args.agreementValue)}\n\n${args.customMessage ?? ""}`;
    return { subject, html, text };
  }

  if (args.emailType === "demand_notice") {
    const subject = `Payment Demand Notice — ${args.projectName} · ${args.unitNumber}`;
    const html = `
      <div style="${baseStyle}">
        <div style="${headerBg}">
          <h1 style="color:#ffffff;margin:0;font-size:22px;">Payment Demand Notice</h1>
          <p style="color:#a7f3d0;margin:6px 0 0;font-size:14px;">${project} · ${unit}</p>
        </div>
        <div style="${bodyBg}">
          <p>Dear <strong>${name}</strong>,</p>
          <p>This is a formal demand notice for the following payment milestones that are now due:</p>
          ${tableHtml(args.installments)}
          <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:16px;margin-top:20px;">
            <p style="margin:0;font-size:14px;"><strong>Outstanding Balance: ${formatInr(args.outstanding)}</strong></p>
            <p style="margin:4px 0 0;font-size:13px;color:#78350f;">Please remit payment at the earliest to avoid any delays in your possession schedule.</p>
          </div>
          ${customBlock}
          ${footer}
        </div>
      </div>`;
    const text = `Payment Demand Notice\n\nDear ${args.buyerName},\n\nProject: ${args.projectName}\nUnit: ${args.unitNumber}\n\nThe following payments are due:\n${args.installments.map((i) => `- ${i.milestone}: ${formatInr(i.amount)} (Due: ${fmtDate(i.dueDate)})`).join("\n")}\n\nOutstanding: ${formatInr(args.outstanding)}\n\n${args.customMessage ?? ""}`;
    return { subject, html, text };
  }

  // reminder
  const subject = `Payment Reminder — ${args.projectName} · ${args.unitNumber}`;
  const html = `
    <div style="${baseStyle}">
      <div style="${headerBg}">
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Payment Reminder</h1>
        <p style="color:#a7f3d0;margin:6px 0 0;font-size:14px;">${project} · ${unit}</p>
      </div>
      <div style="${bodyBg}">
        <p>Dear <strong>${name}</strong>,</p>
        <p>This is a friendly reminder that the following payments are due or upcoming:</p>
        ${tableHtml(args.installments)}
        <p style="margin-top:20px;font-size:14px;">If you have already made this payment, please disregard this reminder.</p>
        ${customBlock}
        ${footer}
      </div>
    </div>`;
  const text = `Payment Reminder\n\nDear ${args.buyerName},\n\nThis is a reminder for payments due:\n${args.installments.map((i) => `- ${i.milestone}: ${formatInr(i.amount)}`).join("\n")}\n\n${args.customMessage ?? ""}`;
  return { subject, html, text };
}
