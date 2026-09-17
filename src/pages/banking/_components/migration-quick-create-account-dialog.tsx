import { useState } from "react";
import { toast } from "sonner";
import { createMigrationAccount } from "@/lib/migration-api.ts";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (account: { accountId: string; name: string }) => void };

export default function MigrationQuickCreateAccountDialog({ open, onOpenChange, onCreated }: Props) {
  const [form, setForm] = useState({ code: "", name: "", type: "expense", group: "indirect_expenses" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) { toast.error("Account code and name are required"); return; }
    setSaving(true);
    try { const account = await createMigrationAccount(form); toast.success(`Created account ${account.code}`); onCreated({ accountId: account._id, name: account.name }); onOpenChange(false); setForm({ code: "", name: "", type: "expense", group: "indirect_expenses" }); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create account"); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Create New Account</DialogTitle></DialogHeader><div className="space-y-3"><Input placeholder="Account code * (e.g. 5201)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /><Input placeholder="Account name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="asset">Asset</option><option value="liability">Liability</option><option value="income">Income</option><option value="expense">Expense</option><option value="equity">Equity</option></select><select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}><option value="bank_and_cash">Bank and Cash</option><option value="current_assets">Current Assets</option><option value="payables">Payables</option><option value="current_liabilities">Current Liabilities</option><option value="sales_income">Sales Income</option><option value="other_income">Other Income</option><option value="direct_expenses">Direct Expenses</option><option value="indirect_expenses">Indirect Expenses</option><option value="finance_charges">Finance Charges</option><option value="capital">Capital</option><option value="reserves">Reserves</option></select></div><DialogFooter><Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? "Creating..." : "Create account"}</Button></DialogFooter></DialogContent></Dialog>;
}
