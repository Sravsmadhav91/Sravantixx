import { describe, expect, it } from "vitest";
import { parseBankStatementRows } from "./bank-parser.ts";

describe("AU Small Finance statement formats", () => {
  it("parses Description/Narration with Debit(Dr.) and Credit(Cr.) columns", () => {
    const result = parseBankStatementRows([
      ["STATEMENT BY PERIOD"],
      ["Account No:", "2502271081690251-INR"],
      ["Opening Balance:", "0.00"],
      ["Trans Date", "Value Date", "Description/Narration", "Chq./Ref No.", "Debit(Dr.) INR", "Credit(Cr.) INR", "Balance INR"],
      ["2026-08-03", "2026-08-03", "NEFT CR - MANISH RAMKRUSHNA - PAYMENT", "SCBLN52026080300", "-", "100.00", "100.00"],
      ["2026-08-04", "2026-08-03", "MIGHTY HOMES AUTO SWEEP OUT", "-", "70.00", "-", "30.00"],
    ]);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({ date: "2026-08-03", debit: 0, credit: 100, balance: 100 });
    expect(result.transactions[1]).toMatchObject({ date: "2026-08-04", debit: 70, credit: 0, balance: 30 });
  });

  it("parses multi-sheet-style rows with PETTY CASH and SALARY narration", () => {
    const result = parseBankStatementRows([
      ["Trans Date", "Value Date", "Description/Narration", "Chq./Ref.No.", "Debit(Dr.) INR", "Credit(Cr.) INR", "Balance INR"],
      ["2026-07-01", "2026-07-01", "IMPS - AMARNATH REDDY - PETTY CASH", "618212916755", "4350.00", "-", "-45793431.50"],
      ["2026-07-09", "2026-07-09", "IMPS - BOLLAM VENKATA SIVA - SALARY", "619010133360", "80000.00", "-", "-47610300.50"],
    ]);

    expect(result.transactions).toHaveLength(2);
    expect(result.transactions.map((transaction) => transaction.description)).toEqual([
      "IMPS - AMARNATH REDDY - PETTY CASH",
      "IMPS - BOLLAM VENKATA SIVA - SALARY",
    ]);
  });
});