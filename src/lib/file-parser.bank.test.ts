import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseBankStatementFile } from "./file-parser.ts";

describe("multi-sheet bank statement import", () => {
  it("merges transactions from every non-empty Excel sheet", async () => {
    const workbook = XLSX.utils.book_new();
    const headers = ["Trans Date", "Value Date", "Description/Narration", "Chq./Ref.No.", "Debit(Dr.) INR", "Credit(Cr.) INR", "Balance INR"];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      headers,
      ["2026-07-01", "2026-07-01", "PETTY CASH DR - EMPLOYEE ONE", "REF-1", "10000", "-", "100000"],
    ]), "July-2026");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      headers,
      ["2026-08-01", "2026-08-01", "SALARY - EMPLOYEE TWO", "REF-2", "25000", "-", "75000"],
    ]), "Aug-2026");

    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([bytes], "statement.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const result = await parseBankStatementFile(file);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((transaction) => transaction.description)).toEqual([
      "PETTY CASH DR - EMPLOYEE ONE",
      "SALARY - EMPLOYEE TWO",
    ]);
  });
});