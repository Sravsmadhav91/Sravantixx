/**
 * Shared GST split helpers.
 *
 * Amounts collected from buyers are GST-inclusive: the buyer pays one total
 * figure that already contains the GST portion. Given the booking's own
 * GST rate (`gstPercent`), we back out the base (taxable) amount and the
 * GST amount from that total.
 *
 *   base = total / (1 + rate/100)
 *   gst  = total - base
 */
export type GstSplit = {
  /** Total amount actually received (unchanged). */
  totalAmount: number;
  /** Taxable base amount backed out of the total. */
  baseAmount: number;
  /** GST portion backed out of the total. */
  gstAmount: number;
  /** The GST rate used for the split, as a percentage (e.g. 5 for 5%). */
  gstPercent: number;
};

/** Splits a GST-inclusive total into base + GST using the given rate. Returns a zero split when rate is absent/zero. */
export function splitGstInclusive(totalAmount: number, gstPercent: number | undefined): GstSplit {
  const rate = gstPercent ?? 0;
  if (rate <= 0) {
    return { totalAmount, baseAmount: totalAmount, gstAmount: 0, gstPercent: 0 };
  }
  const baseAmount = Math.round((totalAmount / (1 + rate / 100)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - baseAmount) * 100) / 100;
  return { totalAmount, baseAmount, gstAmount, gstPercent: rate };
}
