import { useEffect, useState } from "react";
import { toast } from "sonner";
import { parseBankStatementFile } from "@/lib/file-parser.ts";
import { importMigrationBankStatement, migrationGet } from "@/lib/migration-api.ts";
import type { ParseResult } from "@/lib/bank-parser.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { SearchableSelect } from "@/components/ui/searchable-select.tsx";

type Account = { _id: string; code?: string; name: string; type?: string; group?: string };

export default function MigrationImportStatementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) migrationGet<Account[]>("/api/tables/accounts/records").then(setAccounts).catch(() => setAccounts([]));
  }, [open]);

  const parseFile = async (selected: File) => {
    setFile(selected);
    try {
      const result = await parseBankStatementFile(selected);
      setParsed(result);
      if (result.transactions.length === 0) toast.error("No transactions could be detected in this file");
    } catch (error) {
      setParsed(null);
      toast.error(error instanceof Error ? error.message : "Could not read statement");
    }
  };

  const submit = async () => {
    if (!accountId || !parsed?.transactions.length) {
      toast.error("Select a bank account and a valid statement file");
      return;
    }
    setLoading(true);
    try {
      await importMigrationBankStatement({ accountId, accountName: accounts.find((account) => account._id === accountId)?.name, fromDate: parsed.fromDate, toDate: parsed.toDate, openingBalance: parsed.openingBalance, closingBalance: parsed.closingBalance, bankFormat: parsed.bankFormat, transactions: parsed.transactions });
      toast.success(`${parsed.transactions.length} transactions imported`);
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const allowedGroups = new Set(["bank_and_cash", "loans", "current_liabilities", "payables"]);
  const accountOptions = accounts.filter((account) => account.name && (allowedGroups.has(String(account.group || "")) || account.type === "liability")).map((account) => ({ value: account._id, label: account.name, sub: `${account.code || ""}${account.code ? " · " : ""}${String(account.group || account.type || "").replaceAll("_", " ")}`, keywords: `${account.code || ""} ${account.name} ${account.group || ""} ${account.type || ""}` }));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Import Bank Statement</DialogTitle></DialogHeader><div className="space-y-4"><SearchableSelect value={accountId} onValueChange={setAccountId} options={accountOptions} placeholder="Select bank / loan / liability ledger *" searchPlaceholder="Search ledger by name, code, or group" emptyText="No bank, loan, or liability ledgers found" /><Input type="file" accept=".csv,.xlsx,.xls,.ods,.pdf,.txt" onChange={(event) => event.target.files?.[0] && void parseFile(event.target.files[0])} />{file && <p className="text-xs text-muted-foreground">{file.name}{parsed ? ` · ${parsed.transactions.length} transactions · ${parsed.bankFormat}` : ""}</p>}{parsed && parsed.errors.length > 0 && <p className="text-xs text-amber-600">{parsed.errors.join("; ")}</p>}</div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={loading || !parsed?.transactions.length}>{loading ? "Importing..." : "Import Statement"}</Button></DialogFooter></DialogContent></Dialog>;
}