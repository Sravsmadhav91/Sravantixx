import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { migrationGetMock } = vi.hoisted(() => ({
  migrationGetMock: vi.fn(),
}));

vi.mock("@/lib/migration-api.ts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/migration-api.ts")>("@/lib/migration-api.ts");
  return {
    ...actual,
    migrationApiEnabled: true,
    migrationGet: migrationGetMock,
  };
});

import AccountLedgerPage from "./ledger-page";

describe("AccountLedgerPage", () => {
  it("renders the migration ledger data when migration mode is enabled", async () => {
    migrationGetMock.mockResolvedValue({
      account: { _id: "acct-1", code: "1101", name: "Cash", type: "asset", group: "bank_and_cash" },
      openingBalance: 500,
      normalSide: "debit",
      rows: [
        { date: "2025-04-01", entryNumber: "JE-1", narration: "Opening cash", reference: "REF-1", debit: 200, credit: 0, balance: 700 },
      ],
      closingBalance: 700,
    });

    render(
      <MemoryRouter initialEntries={["/accounting/ledger/acct-1"]}>
        <Routes>
          <Route path="/accounting/ledger/:accountId" element={<AccountLedgerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("heading", { name: "Cash" })).toBeInTheDocument());
    expect(screen.getByText("Opening cash")).toBeInTheDocument();
    expect(screen.getByText("JE-1")).toBeInTheDocument();
  });
});
