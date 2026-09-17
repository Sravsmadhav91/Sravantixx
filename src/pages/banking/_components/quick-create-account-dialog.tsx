import { useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  ACCOUNT_GROUPS_BY_TYPE,
  ACCOUNT_GROUP_LABELS,
  ACCOUNT_TYPE_LABELS,
  TYPE_ORDER,
  type AccountType,
  type AccountGroup,
} from "@/lib/accounting.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the newly created account so the caller can auto-select it */
  onCreated: (account: { accountId: Id<"accounts">; name: string }) => void;
};

/**
 * Lets a user create a new ledger account inline — e.g. from the bank
 * reconciliation contra-account picker — without leaving to the Chart of
 * Accounts page. Auto-generates the account code.
 */
export default function QuickCreateAccountDialog({ open, onOpenChange, onCreated }: Props) {
  const quickCreateAccount = useMutation(api.accounting.quickCreateAccount);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("liability");
  const [group, setGroup] = useState<AccountGroup>("current_liabilities");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setType("liability");
    setGroup("current_liabilities");
  };

  const handleTypeChange = (v: AccountType) => {
    setType(v);
    setGroup(ACCOUNT_GROUPS_BY_TYPE[v][0]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Enter an account name");
      return;
    }
    setSaving(true);
    try {
      const result = await quickCreateAccount({ name: name.trim(), type, group });
      toast.success(`Created account "${result.name}" (${result.code})`);
      onCreated({ accountId: result.accountId, name: result.name });
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(
        err instanceof ConvexError ? (err.data as { message: string }).message : "Failed to create account",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Account</DialogTitle>
          <DialogDescription>
            Adds a new account to your Chart of Accounts. The account code is assigned automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="quick-account-name">Account Name</Label>
            <Input
              id="quick-account-name"
              placeholder="e.g. Office Supplies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as AccountType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>{ACCOUNT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group</Label>
              <Select value={group} onValueChange={(v) => setGroup(v as AccountGroup)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_GROUPS_BY_TYPE[type].map((g) => (
                    <SelectItem key={g} value={g}>{ACCOUNT_GROUP_LABELS[g]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
