import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createMigrationVoucher, migrationGet } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

type Account = { _id: string; code: string; name: string; type: string };
const configs = { sales: { label: "Sales Voucher", debit: "Buyer / Customer Account", credit: "Sales / Income Account" }, purchase: { label: "Purchase Voucher", debit: "Purchase / Expense Account", credit: "Vendor Payable Account" }, payment: { label: "Payment Voucher", debit: "Expense / Payee Account", credit: "Bank / Cash Account" } } as const;

export default function MigrationVoucherDialog({ open, onOpenChange, voucherType }: { open: boolean; onOpenChange: (open: boolean) => void; voucherType: keyof typeof configs }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [narration, setNarration] = useState("");
  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const config = configs[voucherType];
  useEffect(() => { if (open) migrationGet<Account[]>("/api/accounting/accounts").then(setAccounts).catch(() => setAccounts([])); }, [open]);
  const submit = async () => { if (!debitAccountId || !creditAccountId || !amount || !narration.trim()) { toast.error("Accounts, amount, and narration are required"); return; } setSaving(true); try { await createMigrationVoucher({ voucherType, date, reference, narration, debitAccountId, creditAccountId, amount: Number(amount) }); toast.success(`${config.label} posted`); onOpenChange(false); window.location.reload(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not post voucher"); } finally { setSaving(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>New {config.label}</DialogTitle></DialogHeader><div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /><Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} /></div><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)}><option value="">{config.debit}</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.code} — {account.name}</option>)}</select><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={creditAccountId} onChange={(e) => setCreditAccountId(e.target.value)}><option value="">{config.credit}</option>{accounts.map((account) => <option key={account._id} value={account._id}>{account.code} — {account.name}</option>)}</select><textarea className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} /><Input type="number" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} /></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Posting..." : `Post ${config.label}`}</Button></DialogFooter></DialogContent></Dialog>;
}
