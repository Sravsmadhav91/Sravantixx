"use node";

import { ConvexError, v } from "convex/values";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { action } from "./_generated/server.js";

// ── Extraction schema ─────────────────────────────────────────────────────

const ExtractedLine = z.object({
  description: z.string(),
  quantity: z.number(),
  rate: z.number(),
  amount: z.number(),
});

const ExtractedInvoice = z.object({
  vendorName: z.string(),
  invoiceNumber: z.string(),
  /** YYYY-MM-DD, empty string if not found */
  date: z.string(),
  /** YYYY-MM-DD, empty string if not found */
  dueDate: z.string(),
  lines: z.array(ExtractedLine),
  cgst: z.number(),
  sgst: z.number(),
  igst: z.number(),
  tds: z.number(),
  total: z.number(),
  /** True if the AI could not confidently read the document */
  lowConfidence: z.boolean(),
});

export type ScannedInvoice = z.infer<typeof ExtractedInvoice>;

const SYSTEM_PROMPT = `You are an expert accountant extracting structured data from a vendor purchase invoice (photo or PDF) for an Indian real-estate developer's ERP.

Rules:
- Dates must be normalized to YYYY-MM-DD. If a date is ambiguous or missing, use an empty string.
- Line items: capture each distinct billed item/service with quantity, rate, and amount (quantity × rate). If quantity is not stated, use 1 and set rate = amount.
- CGST/SGST/IGST/TDS: extract the tax amounts shown on the invoice in INR. If a tax type is not present, use 0. Do not guess GST rates — only report amounts actually printed on the invoice.
- total: the final payable amount printed on the invoice (after tax, after TDS deduction if shown).
- Set lowConfidence to true if the image/PDF is blurry, cropped, or you are unsure about key fields (vendor name, invoice number, or total).
- Never fabricate data. If a field cannot be read, leave it as an empty string (for text) or 0 (for numbers).`;

export const scanInvoice = action({
  args: {
    /** data URL, e.g. "data:image/jpeg;base64,..." or "data:application/pdf;base64,..." */
    fileDataUrl: v.string(),
  },
  handler: async (ctx, args): Promise<ScannedInvoice> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in to continue" });
    }

    const openai = new OpenAI({
      baseURL: "https://ai-gateway.hercules.app/v1",
      apiKey: process.env.HERCULES_API_KEY,
    });

    const isPdf = args.fileDataUrl.startsWith("data:application/pdf");

    try {
      const response = await openai.chat.completions.parse({
        model: "openai/gpt-5.6-sol",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract the structured invoice data from this document." },
              isPdf
                ? {
                    type: "file",
                    file: { filename: "invoice.pdf", file_data: args.fileDataUrl },
                  }
                : { type: "image_url", image_url: { url: args.fileDataUrl } },
            ],
          },
        ],
        response_format: zodResponseFormat(ExtractedInvoice, "invoice"),
      });

      const parsed = response.choices[0]?.message?.parsed;
      if (!parsed) {
        throw new ConvexError({
          code: "EXTERNAL_SERVICE_ERROR",
          message: "AI could not read this document. Try a clearer photo or a different file.",
        });
      }
      return parsed;
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      if (error instanceof OpenAI.APIError) {
        throw new ConvexError({
          code: "EXTERNAL_SERVICE_ERROR",
          message: `AI scan failed: ${error.message}`,
        });
      }
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Failed to scan invoice. Please try again.",
      });
    }
  },
});
