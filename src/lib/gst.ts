/**
 * Frontend mirror of convex/lib/gst.ts — keep both in sync.
 *
 * Amounts collected from buyers are GST-inclusive: the buyer pays one total
 * figure that already contains the GST portion. Given a GST rate, this
 * backs out the base (taxable) amount and the GST amount from that total,
 * purely for display purposes (the backend computes and stores the
 * authoritative split when the receipt is created).
 */
export type GstSplit = {
  totalAmount: number;
  baseAmount: number;
  gstAmount: number;
  gstPercent: number;
};

export function splitGstInclusive(totalAmount: number, gstPercent: number | undefined): GstSplit {
  const rate = gstPercent ?? 0;
  if (rate <= 0 || !totalAmount) {
    return { totalAmount, baseAmount: totalAmount, gstAmount: 0, gstPercent: 0 };
  }
  const baseAmount = Math.round((totalAmount / (1 + rate / 100)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  return { totalAmount, baseAmount, gstAmount, gstPercent: rate };
}
