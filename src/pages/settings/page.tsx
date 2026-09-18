import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { Mail, ShieldCheck, UserPlus, Trash2, Users, Clock } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { formatDateTime } from "@/lib/format.ts";
import { useRole } from "@/hooks/use-role.ts";
import {
  migrationApiEnabled,
  listMigrationTeamMembers,
  listMigrationTeamRoles,
  getMigrationEmailSettings,
  saveMigrationEmailSettings,
  inviteMigrationTeamMember,
  removeMigrationTeamMember,
  updateMigrationTeamMemberRole,
} from "@/lib/migration-api.ts";

type RoleCatalogEntry = { role: "staff" | "accountant" | "sales" | "site_engineer" | "site_supervisor" | "project_manager"; label: string; description: string };

function MemberRow({
  member,
  roles,
  onRemove,
  onChangeRole,
}: {
  member: Doc<"teamMembers">;
  roles: RoleCatalogEntry[] | undefined;
  onRemove: (id: Doc<"teamMembers">["_id"]) => void;
  onChangeRole: (id: Doc<"teamMembers">["_id"], role: RoleCatalogEntry["role"]) => void;
}) {
  const currentRole = member.role ?? "staff";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {member.memberName ?? member.email}
        </p>
        {member.memberName && (
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          Invited {formatDateTime(member.invitedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Select
          value={currentRole}
          onValueChange={(value) => onChangeRole(member._id, value as RoleCatalogEntry["role"])}
        >
          <SelectTrigger size="sm" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(roles ?? []).map((r) => (
              <SelectItem key={r.role} value={r.role}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge
          variant="secondary"
          className={
            member.status === "active"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
          }
        >
          {member.status === "active" ? "Active" : "Pending"}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Remove ${member.email}`}
          onClick={() => onRemove(member._id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  if (migrationApiEnabled) {
    return <MigrationSettingsPage />;
  }

  const { isOwner, role, isLoading: roleLoading } = useRole();
  const members = useQuery(api.team.listMembers);
  const roles = useQuery(api.team.listRoles);
  const invite = useMutation(api.team.invite);
  const removeMember = useMutation(api.team.removeMember);
  const setMemberRole = useMutation(api.team.setMemberRole);
  const emailSettings = useQuery(api.emails.getEmailSettings);
  const saveEmailSettings = useMutation(api.emails.saveEmailSettings);

  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Doc<"teamMembers">["_id"] | null>(null);

  // Email settings local state
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [emailSettingsInitialised, setEmailSettingsInitialised] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // Populate email fields once loaded (one-time)
  if (emailSettings && !emailSettingsInitialised) {
    setSenderName(emailSettings.emailSenderName ?? "");
    setSenderAddress(emailSettings.emailSenderAddress ?? "");
    setReplyTo(emailSettings.emailReplyTo ?? "");
    setEmailSettingsInitialised(true);
  }

  // Show a role-info card for non-owners
  if (!roleLoading && !isOwner) {
    const roleCopy: Record<string, { label: string; description: string }> = {
      staff: {
        label: "Staff",
        description:
          "You have read and write access to all data but cannot delete records or manage the team.",
      },
      accountant: {
        label: "Accountant",
        description:
          "You have access to Accounting, Payables, Banking, GST Returns, TDS Filing, Payroll, and Reports. You cannot delete records.",
      },
      sales: {
        label: "Sales",
        description:
          "You have access to Buyers, Bookings, Collections, and Leads. You cannot delete records.",
      },
      site_engineer: {
        label: "Site Engineer",
        description:
          "You have access to Projects, Construction, and Inventory. You cannot delete records.",
      },
    };
    const copy = roleCopy[role] ?? roleCopy.staff;
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Account and team settings</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              Your role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You are a <strong>{copy.label}</strong> member on this account. {copy.description}{" "}
              Contact your account owner if you need elevated access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSaveEmailSettings = async () => {
    setSavingEmail(true);
    try {
      await saveEmailSettings({
        emailSenderName: senderName.trim(),
        emailSenderAddress: senderAddress.trim(),
        emailReplyTo: replyTo.trim(),
      });
      toast.success("Email settings saved");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not save settings",
      );
    } finally {
      setSavingEmail(false);
    }
  };

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    try {
      await invite({ email: trimmed });
      toast.success(`Invite sent to ${trimmed}`);
      setEmail("");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not send the invite",
      );
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (teamMemberId: Doc<"teamMembers">["_id"]) => {
    try {
      await removeMember({ teamMemberId });
      toast.success("Team member removed");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not remove member",
      );
    } finally {
      setRemoving(null);
    }
  };

  const handleChangeRole = async (
    teamMemberId: Doc<"teamMembers">["_id"],
    role: RoleCatalogEntry["role"],
  ) => {
    try {
      await setMemberRole({ teamMemberId, role });
      toast.success("Role updated");
    } catch (err) {
      toast.error(
        err instanceof ConvexError
          ? (err.data as { message: string }).message
          : "Could not update role",
      );
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your team</p>
      </div>

      {/* Role explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Team roles
          </CardTitle>
          <CardDescription>
            You are the <strong>Owner</strong> of this account. Only you can delete
            records. Team members you invite default to Staff, and you can
            assign them a more specific role from the list below at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Owner</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Full read + write access</li>
                <li>Can delete records</li>
                <li>Can invite, remove, and assign roles</li>
                <li>Can cancel bookings</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Staff (all modules)</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Full read access to everything</li>
                <li>Can create and edit records</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Accountant</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Accounting, Payables, Banking</li>
                <li>GST Returns, TDS Filing, Payroll</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Sales</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Buyers, Bookings, Collections, Leads</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Site Engineer</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Projects, Construction, Inventory</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Email configuration
          </CardTitle>
          <CardDescription>
            Configure the sender details used when emailing buyers from Collections.
            You must verify your sender email address first in the{" "}
            <strong>Emails</strong> tab on the left sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailSettings === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sender-name">Sender display name</Label>
                <Input
                  id="sender-name"
                  placeholder="e.g. Sravantix Realty"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Shown as "From" name in email clients</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sender-address">Verified sender email</Label>
                <Input
                  id="sender-address"
                  type="email"
                  placeholder="e.g. collections@yourcompany.com"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be verified in Emails → Verify email before emails will send
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reply-to">Reply-to address <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="reply-to"
                  type="email"
                  placeholder="e.g. accounts@yourcompany.com"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </div>
              <Button
                onClick={() => void handleSaveEmailSettings()}
                disabled={savingEmail || !senderAddress.trim()}
                className="mt-1"
              >
                Save email settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Invite staff member
          </CardTitle>
          <CardDescription>
            Enter the email address of the person you want to add. They will
            gain access when they sign in with that email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleInvite();
              }}
              className="flex-1"
            />
            <Button onClick={() => void handleInvite()} disabled={inviting || !email.trim()}>
              <UserPlus className="size-4" />
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Team members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock />
                </EmptyMedia>
                <EmptyTitle>No team members yet</EmptyTitle>
                <EmptyDescription>
                  Invite a colleague above to give them access.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <MemberRow
                  key={m._id}
                  member={m}
                  roles={roles}
                  onRemove={(id) => setRemoving(id)}
                  onChangeRole={(id, role) => void handleChangeRole(id, role)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access immediately. You can re-invite them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && void handleRemove(removing)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MigrationSettingsPage() {
  const [members, setMembers] = useState<any[] | undefined>(undefined);
  const [roles, setRoles] = useState<RoleCatalogEntry[] | undefined>(undefined);
  const [emailSettings, setEmailSettings] = useState<{
    emailSenderName: string;
    emailSenderAddress: string;
    emailReplyTo: string;
  } | null | undefined>(undefined);
  const [senderName, setSenderName] = useState("");
  const [senderAddress, setSenderAddress] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [email, setEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([listMigrationTeamMembers(), listMigrationTeamRoles(), getMigrationEmailSettings()])
      .then(([teamMembers, teamRoles, settings]) => {
        if (!active) return;
        setMembers(teamMembers);
        setRoles(teamRoles ?? []);
        setEmailSettings(settings);
        setSenderName(settings.emailSenderName ?? "");
        setSenderAddress(settings.emailSenderAddress ?? "");
        setReplyTo(settings.emailReplyTo ?? "");
      })
      .catch(() => {
        if (active) {
          setMembers([]);
          setRoles([]);
          setEmailSettings(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSaveEmailSettings = async () => {
    setSavingEmail(true);
    try {
      const payload = {
        emailSenderName: senderName.trim(),
        emailSenderAddress: senderAddress.trim(),
        emailReplyTo: replyTo.trim(),
      };
      await saveMigrationEmailSettings(payload);
      setEmailSettings(payload);
      toast.success("Email settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    } finally {
      setSavingEmail(false);
    }
  };

  const handleInvite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    try {
      await inviteMigrationTeamMember({ email: trimmed });
      const refreshed = await listMigrationTeamMembers();
      setMembers(refreshed);
      setEmail("");
      toast.success(`Invite sent to ${trimmed}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (teamMemberId: string) => {
    try {
      await removeMigrationTeamMember(teamMemberId);
      setMembers((current) => current ? current.filter((member) => member._id !== teamMemberId) : current);
      toast.success("Team member removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove member");
    } finally {
      setRemoving(null);
    }
  };

  const handleChangeRole = async (teamMemberId: string, role: RoleCatalogEntry["role"]) => {
    try {
      await updateMigrationTeamMemberRole(teamMemberId, role);
      setMembers((current) =>
        current ? current.map((member) => (member._id === teamMemberId ? { ...member, role } : member)) : current,
      );
      toast.success("Role updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update role");
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your team</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            Team roles
          </CardTitle>
          <CardDescription>
            You are the <strong>Owner</strong> of this account. Only you can delete records. Team members you invite default to Staff, and you can assign them a more specific role from the list below at any time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Owner</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Full read + write access</li>
                <li>Can delete records</li>
                <li>Can invite, remove, and assign roles</li>
                <li>Can cancel bookings</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Staff (all modules)</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Full read access to everything</li>
                <li>Can create and edit records</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Accountant</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Accounting, Payables, Banking</li>
                <li>GST Returns, TDS Filing, Payroll</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Sales</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Buyers, Bookings, Collections, Leads</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1">
              <p className="font-semibold">Site Engineer</p>
              <ul className="text-muted-foreground space-y-0.5 text-xs list-disc list-inside">
                <li>Projects, Construction, Inventory</li>
                <li>Cannot delete records</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5 text-primary" />
            Email configuration
          </CardTitle>
          <CardDescription>
            Configure the sender details used when emailing buyers from Collections. You must verify your sender email address first in the <strong>Emails</strong> tab on the left sidebar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {emailSettings === undefined ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sender-name">Sender display name</Label>
                <Input
                  id="sender-name"
                  placeholder="e.g. Sravantix Realty"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Shown as "From" name in email clients</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sender-address">Verified sender email</Label>
                <Input
                  id="sender-address"
                  type="email"
                  placeholder="e.g. collections@yourcompany.com"
                  value={senderAddress}
                  onChange={(e) => setSenderAddress(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be verified in Emails → Verify email before emails will send
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reply-to">Reply-to address <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="reply-to"
                  type="email"
                  placeholder="e.g. accounts@yourcompany.com"
                  value={replyTo}
                  onChange={(e) => setReplyTo(e.target.value)}
                />
              </div>
              <Button
                onClick={() => void handleSaveEmailSettings()}
                disabled={savingEmail || !senderAddress.trim()}
                className="mt-1"
              >
                Save email settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-primary" />
            Invite staff member
          </CardTitle>
          <CardDescription>
            Enter the email address of the person you want to add. They will gain access when they sign in with that email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleInvite();
              }}
              className="flex-1"
            />
            <Button onClick={() => void handleInvite()} disabled={inviting || !email.trim()}>
              <UserPlus className="size-4" />
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Team members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members === undefined ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Clock />
                </EmptyMedia>
                <EmptyTitle>No team members yet</EmptyTitle>
                <EmptyDescription>
                  Invite a colleague above to give them access.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <MemberRow
                  key={member._id}
                  member={member}
                  roles={roles}
                  onRemove={(id) => setRemoving(id)}
                  onChangeRole={(id, role) => void handleChangeRole(id, role)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access immediately. You can re-invite them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && void handleRemove(removing)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
