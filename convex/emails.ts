import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api.js";
import { requireUser, effectiveOwnerId } from "./lib/auth.ts";

// ─── Settings ────────────────────────────────────────────────────────────────

export const getEmailSettings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);
    const owner = await ctx.db.get("users", ownerId);
    return {
      emailSenderName: owner?.emailSenderName ?? "",
      emailSenderAddress: owner?.emailSenderAddress ?? "",
      emailReplyTo: owner?.emailReplyTo ?? "",
    };
  },
});

export const saveEmailSettings = mutation({
  args: {
    emailSenderName: v.string(),
    emailSenderAddress: v.string(),
    emailReplyTo: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (user.role && user.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the account owner can change email settings" });
    }
    await ctx.db.patch("users", user._id, {
      emailSenderName: args.emailSenderName || undefined,
      emailSenderAddress: args.emailSenderAddress || undefined,
      emailReplyTo: args.emailReplyTo || undefined,
    });
    return null;
  },
});

// ─── Stamp emailedAt (internal mutation, called from Node action) ─────────────

export const markEmailed = internalMutation({
  args: { installmentIds: v.array(v.id("paymentInstallments")) },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    for (const id of args.installmentIds) {
      await ctx.db.patch("paymentInstallments", id, { emailedAt: now });
    }
    return null;
  },
});

// ─── Public mutation: trigger email send from frontend ───────────────────────

export const sendPaymentReminderEmail = mutation({
  args: {
    bookingId: v.id("bookings"),
    installmentIds: v.array(v.id("paymentInstallments")),
    emailType: v.union(v.literal("demand_notice"), v.literal("reminder"), v.literal("booking_confirmation")),
    customMessage: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const booking = await ctx.db.get("bookings", args.bookingId);
    if (!booking || booking.ownerId !== ownerId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Booking not found" });
    }

    const buyer = await ctx.db.get("buyers", booking.buyerId);
    if (!buyer?.email) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Buyer does not have an email address on file",
      });
    }

    const unit = await ctx.db.get("units", booking.unitId);
    const project = unit ? await ctx.db.get("projects", unit.projectId) : null;

    const owner = await ctx.db.get("users", ownerId);
    if (!owner?.emailSenderAddress) {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "No verified sender email configured. Go to Settings → Email to add one.",
      });
    }

    const installments = await Promise.all(
      args.installmentIds.map((id) => ctx.db.get("paymentInstallments", id)),
    );
    const validInst = installments.filter(
      (i): i is NonNullable<typeof i> => i !== null,
    );

    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_booking", (q) => q.eq("bookingId", args.bookingId))
      .collect();
    const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);

    await ctx.scheduler.runAfter(0, internal.emailActions.doSendEmail, {
      emailType: args.emailType,
      buyerEmail: buyer.email,
      buyerName: buyer.name,
      buyerPhone: buyer.phone,
      projectName: project?.name ?? "—",
      projectRera: project?.reraNumber ?? undefined,
      unitNumber: unit?.number ?? "—",
      unitBlock: unit?.block ?? undefined,
      unitConfiguration: unit?.configuration ?? undefined,
      agreementValue: booking.agreementValue,
      totalReceived,
      outstanding: booking.agreementValue - totalReceived,
      installments: validInst.map((i) => ({
        milestone: i.milestone,
        amount: i.amount,
        dueDate: i.dueDate ?? undefined,
        status: i.status,
      })),
      installmentIds: args.installmentIds,
      senderAddress: owner.emailSenderAddress,
      senderName: owner.emailSenderName ?? "Sravantix",
      replyTo: owner.emailReplyTo ?? undefined,
      customMessage: args.customMessage ?? undefined,
    });

    return buyer.email;
  },
});
