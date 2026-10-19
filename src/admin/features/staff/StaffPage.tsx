import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { getSupabaseClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/auth/useSession";

const ROLES: AppRole[] = ["principal", "accountant", "teacher", "parent"];
const INVITABLE_ROLES: Extract<AppRole, "teacher" | "accountant">[] = ["teacher", "accountant"];

export default function StaffPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [designationByProfile, setDesignationByProfile] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<(typeof INVITABLE_ROLES)[number]>("teacher");
  const [inviteDesignation, setInviteDesignation] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles_with_roles_and_staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, user_roles(role), staff(id, designation, staff_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  async function createStaffRecord(profileId: string) {
    const designation = designationByProfile[profileId] || "Teacher";
    const { error } = await supabase
      .from("staff")
      .insert({ profile_id: profileId, designation });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Staff record created");
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Staff &amp; Roles</h1>
        <p className="text-muted-foreground">
          Invite new staff, assign or revoke roles, and manage account access.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Invite staff</h2>
        <p className="text-muted-foreground text-sm">
          The invited person signs up themselves at the regular login page using this exact
          email address — they're automatically granted the role below the moment they do,
          with no separate approval step needed. Nothing they type during signup can change
          the role; it's fixed here, by you, in advance.
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>{inv.email}</TableCell>
                  <TableCell className="capitalize">{inv.role}</TableCell>
                  <TableCell className="capitalize">{inv.status}</TableCell>
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
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Everyone who has signed up</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Staff record</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((p) => {
              const roles = (p.user_roles ?? []).map((r: { role: string }) => r.role as AppRole);
              const staffRecord = p.staff as unknown as
                | { id: string; designation: string | null; staff_code: string | null }[]
                | null;
              const hasStaff = Array.isArray(staffRecord) && staffRecord.length > 0;

              return (
                <TableRow key={p.id}>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    {roles.length === 0 && "none"}
                    {roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1 mr-2 text-sm"
                      >
                        {role}
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Revoke ${role}`}
                          onClick={() => revokeRole(p.id, role)}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </TableCell>
                  <TableCell>
                    {hasStaff ? staffRecord![0].designation ?? "Yes" : "—"}
                  </TableCell>
                  <TableCell>{p.is_active ? "Active" : "Deactivated"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2 items-center flex-wrap">
                      <Select onValueChange={(role) => assignRole(p.id, role as AppRole)}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Grant role…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!hasStaff && (
                        <>
                          <Input
                            placeholder="Designation"
                            className="w-32"
                            value={designationByProfile[p.id] ?? ""}
                            onChange={(e) =>
                              setDesignationByProfile((prev) => ({
                                ...prev,
                                [p.id]: e.target.value,
                              }))
                            }
                          />
                          <Button variant="outline" onClick={() => createStaffRecord(p.id)}>
                            Create staff record
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(p.id, p.is_active)}
                      >
                        {p.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
