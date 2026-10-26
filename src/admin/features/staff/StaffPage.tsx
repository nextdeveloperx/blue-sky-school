import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { InfoHelp } from "@/components/InfoHelp";
import { RowActionsMenu, type RowAction } from "@/components/RowActionsMenu";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/auth/useSession";

const ROLES: AppRole[] = ["principal", "accountant", "teacher", "parent"];
const INVITABLE_ROLES: Extract<AppRole, "teacher" | "accountant">[] = ["teacher", "accountant"];

interface ProfileRow {
  id: string;
  email: string | null;
  is_active: boolean;
  roles: AppRole[];
  staffId: string | null;
  staffDesignation: string | null;
  staffCode: string | null;
}

export default function StaffPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof INVITABLE_ROLES)[number]>("teacher");
  const [inviteDesignation, setInviteDesignation] = useState("");
  const [confirmGrantPrincipal, setConfirmGrantPrincipal] = useState<ProfileRow | null>(null);
  const [staffRecordDialog, setStaffRecordDialog] = useState<ProfileRow | null>(null);
  const [staffRecordDesignation, setStaffRecordDesignation] = useState("");
  const [detailProfile, setDetailProfile] = useState<ProfileRow | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["profiles_with_roles_and_staff"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role), staff(id, designation, staff_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => {
        const staffRecord = (p.staff as unknown as
          | { id: string; designation: string | null; staff_code: string | null }[]
          | null) ?? [];
        return {
          id: p.id,
          email: p.email,
          is_active: p.is_active,
          roles: (p.user_roles ?? []).map((r: { role: string }) => r.role as AppRole),
          staffId: staffRecord[0]?.id ?? null,
          staffDesignation: staffRecord[0]?.designation ?? null,
          staffCode: staffRecord[0]?.staff_code ?? null,
        };
      });
    },
  });

  const { data: invitations } = useQuery({
    queryKey: ["staff_invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_invitations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredProfiles = useMemo(() => {
    if (!profiles) return profiles;
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => (p.email ?? "").toLowerCase().includes(q));
  }, [profiles, search]);

  async function assignRole(profileId: string, role: AppRole) {
    const { error } = await supabase.rpc("assign_role", {
      target_user_id: profileId,
      new_role: role,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Granted ${role}`);
    queryClient.invalidateQueries({ queryKey: ["profiles_with_roles_and_staff"] });
  }

  async function revokeRole(profileId: string, role: AppRole) {
    const { error } = await supabase.rpc("revoke_role", {
      p_user_id: profileId,
      p_role: role,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Revoked ${role}`);
    queryClient.invalidateQueries({ queryKey: ["profiles_with_roles_and_staff"] });
  }

  async function toggleActive(profileId: string, isActive: boolean) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !isActive })
      .eq("id", profileId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isActive ? "Account deactivated" : "Account reactivated");
    queryClient.invalidateQueries({ queryKey: ["profiles_with_roles_and_staff"] });
  }

  async function createStaffRecord() {
    if (!staffRecordDialog) return;
    const { error } = await supabase
      .from("staff")
      .insert({ profile_id: staffRecordDialog.id, designation: staffRecordDesignation || "Teacher" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff record created");
    setStaffRecordDialog(null);
    setStaffRecordDesignation("");
    queryClient.invalidateQueries({ queryKey: ["profiles_with_roles_and_staff"] });
  }

  async function inviteStaff() {
    if (!inviteEmail) {
      toast.error("Enter an email to invite");
      return;
    }
    const { error } = await supabase.rpc("invite_staff", {
      p_email: inviteEmail,
      p_role: inviteRole,
      p_designation: inviteDesignation || undefined,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail("");
    setInviteDesignation("");
    queryClient.invalidateQueries({ queryKey: ["staff_invitations"] });
  }

  async function revokeInvitation(invitationId: string) {
    const { error } = await supabase.rpc("revoke_invitation", {
      p_invitation_id: invitationId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Invitation revoked");
    queryClient.invalidateQueries({ queryKey: ["staff_invitations"] });
  }

  function actionsFor(p: ProfileRow): RowAction[] {
    const actions: RowAction[] = [];
    actions.push({ label: "View details", onSelect: () => setDetailProfile(p) });

    const grantable = ROLES.filter((r) => !p.roles.includes(r));
    for (const role of grantable) {
      actions.push({
        label: `Grant ${role}`,
        separatorBefore: actions.length === 1,
        onSelect: () => {
          if (role === "principal") {
            setConfirmGrantPrincipal(p);
          } else {
            assignRole(p.id, role);
          }
        },
      });
    }

    for (const role of p.roles) {
      actions.push({
        label: `Revoke ${role}`,
        separatorBefore: role === p.roles[0],
        destructive: true,
        onSelect: () => revokeRole(p.id, role),
      });
    }

    if (!p.staffId) {
      actions.push({
        label: "Create staff record",
        separatorBefore: true,
        onSelect: () => {
          setStaffRecordDialog(p);
          setStaffRecordDesignation("");
        },
      });
    }

    actions.push({
      label: p.is_active ? "Deactivate account" : "Reactivate account",
      separatorBefore: !p.staffId ? false : true,
      destructive: p.is_active,
      onSelect: () => toggleActive(p.id, p.is_active),
    });

    return actions;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Staff &amp; Roles</h1>
          <p className="text-muted-foreground">
            Invite new staff, assign or revoke roles, and manage account access.
          </p>
        </div>
        <InfoHelp
          title="Staff & Roles"
          content={{
            purpose:
              "Control who can sign in and what they're allowed to do: invite new teachers or accountants, grant or remove roles on existing accounts, and turn access on or off without deleting anyone's history.",
            steps: [
              "To add a new teacher or accountant: enter their email, pick the role, and select \"Send invitation\".",
              "To change an existing account's access: use the ⋮ menu on their row.",
              "To temporarily stop someone from signing in without deleting their record: select Deactivate (Reactivate undoes this).",
            ],
            rules: [
              "An invitation only ever applies to the exact email address you enter — it has no effect on any other account.",
              "Granting \"principal\" gives full control of the whole system — you'll be asked to confirm before it takes effect.",
              "Deactivating an account blocks sign-in immediately but keeps all their past records (payments recorded, marks entered, etc.) intact.",
            ],
            nextSteps:
              "An invited person gets access the moment they sign up with the matching email — there's no separate approval step for them to wait on.",
          }}
        />
      </div>

      <section className="card-elevated p-4 space-y-3">
        <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" aria-hidden="true" />
          Invite staff
        </h2>
        <p className="text-muted-foreground text-sm">
          The person must sign up using <strong>exactly this email address</strong> — as soon as
          they do, they're given the role you pick below, with no extra approval step. If they
          sign up with a different email, this invitation does nothing for that account; it stays
          waiting here until you revoke it or they use the correct email.
        </p>
        <div className="flex gap-2 items-end flex-wrap">
          <Input
            type="email"
            placeholder="Email address"
            className="w-64"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INVITABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Designation (optional)"
            className="w-48"
            value={inviteDesignation}
            onChange={(e) => setInviteDesignation(e.target.value)}
          />
          <Button onClick={inviteStaff}>Send invitation</Button>
        </div>

        {invitations && invitations.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                      {inv.email}
                    </TableCell>
                    <TableCell className="capitalize">{inv.role}</TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.status === "pending" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeInvitation(inv.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="card-elevated p-4 space-y-3">
        <h2 className="font-heading font-semibold text-lg">Everyone who has signed up</h2>
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Account status</TableHead>
                <TableHead>Staff record</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    {p.roles.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No role</span>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {p.roles.map((role) => (
                          <StatusBadge key={role} status={role} />
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.is_active ? "active" : "inactive"} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.staffId ? p.staffDesignation ?? "Yes" : "None"}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActionsMenu label={p.email ?? "this account"} actions={actionsFor(p)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <AlertDialog open={!!confirmGrantPrincipal} onOpenChange={(open) => !open && setConfirmGrantPrincipal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Grant full principal access?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmGrantPrincipal?.email} will gain complete control of the entire system —
              every student, staff, financial, and academic record, plus the ability to grant or
              revoke anyone else's access, including yours. Only do this for someone who should
              genuinely have full administrative control of the school.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmGrantPrincipal) assignRole(confirmGrantPrincipal.id, "principal");
                setConfirmGrantPrincipal(null);
              }}
            >
              Grant principal access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!staffRecordDialog} onOpenChange={(open) => !open && setStaffRecordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a staff record for {staffRecordDialog?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Designation</label>
              <Input
                placeholder="e.g. Mathematics Teacher"
                value={staffRecordDesignation}
                onChange={(e) => setStaffRecordDesignation(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={createStaffRecord}>
              Create staff record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailProfile} onOpenChange={(open) => !open && setDetailProfile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account details</DialogTitle>
          </DialogHeader>
          {detailProfile && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email (authentication account)</span>
                <span className="font-medium">{detailProfile.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Application role(s)</span>
                <span className="font-medium capitalize">
                  {detailProfile.roles.length > 0 ? detailProfile.roles.join(", ") : "None"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account status</span>
                <StatusBadge status={detailProfile.is_active ? "active" : "inactive"} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Staff record</span>
                <span className="font-medium">
                  {detailProfile.staffId
                    ? `${detailProfile.staffDesignation ?? "—"} (${detailProfile.staffCode ?? "no code"})`
                    : "No staff record"}
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
