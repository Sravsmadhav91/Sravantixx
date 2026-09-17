import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { parseImsFile } from "./ims-parser.ts";

function workbookFile(sheets: Record<string, unknown[][]>): File {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  return new File([bytes], "gst-portal.xlsx");
}

describe("GST portal IMS/GSTR-2B parser", () => {
  it("parses one-row GSTR-2B headers and Indian slash dates as day/month/year", async () => {
    const file = workbookFile({
      B2B: [
        ["GSTIN of supplier", "Trade/Legal name", "Invoice number", "Invoice type", "Invoice Date", "Invoice Value(₹)", "Status", "Place of supply", "Taxable Value (₹)", "Integrated Tax(₹)", "Central Tax(₹)", "State/UT Tax(₹)", "Cess(₹)"],
        ["29AAAAB1234C1Z1", "Supplier One", "INV-1", "Regular", "03/07/2026", 64900, "Accepted", "Karnataka", 55000, 0, 4950, 4950, 0],
      ],
    });

    const result = await parseImsFile(file);
    expect(result.parseErrors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ invoiceNumber: "INV-1", invoiceDate: "2026-07-03", isCreditNote: false });
  });

  it("parses stacked headers, hyphen dates, Excel serial dates, and credit notes while skipping debit notes", async () => {
    const file = workbookFile({
      B2B: [
        ["GSTIN of supplier", "Trade/Legal name", "Invoice Details", "", "", "Tax Amount", "", "", ""],
        ["", "", "Invoice number", "Invoice type", "Invoice Date", "Taxable Value (₹)", "Integrated Tax(₹)", "Central Tax(₹)", "State/UT Tax(₹)"],
        ["29AAAAB1234C1Z1", "Supplier One", "INV-2", "Regular", "11-04-2026", 1000, 0, 90, 90],
        ["29AAAAB1234C1Z1", "Supplier One", "INV-3", "Regular", 46113, 2000, 0, 180, 180],
      ],
      "B2B-CDNR": [
        ["GSTIN of supplier", "Trade/Legal name", "Note number", "Note type", "Note date", "Taxable Value (₹)", "Integrated Tax(₹)", "Central Tax(₹)", "State/UT Tax(₹)"],
        ["29AAAAB1234C1Z1", "Supplier One", "CN-1", "Credit Note", "12/04/2026", 300, 0, 27, 27],
        ["29AAAAB1234C1Z1", "Supplier One", "DN-1", "Debit Note", "13/04/2026", 400, 0, 36, 36],
      ],
    });

    const result = await parseImsFile(file);
    expect(result.parseErrors).toEqual([]);
    expect(result.invoiceCount).toBe(2);
    expect(result.creditNoteCount).toBe(1);
    expect(result.rows.map((row) => row.invoiceNumber)).toEqual(["INV-2", "INV-3", "CN-1"]);
    expect(result.rows[0].invoiceDate).toBe("2026-04-11");
    expect(result.rows[1].invoiceDate).toBe("2026-04-01");
    expect(result.rows[2]).toMatchObject({ invoiceDate: "2026-04-12", isCreditNote: true });
  });
});
