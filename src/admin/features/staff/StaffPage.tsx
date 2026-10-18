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

export default function StaffPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [designationByProfile, setDesignationByProfile] = useState<Record<string, string>>({});

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Staff &amp; Roles</h1>
        <p className="text-muted-foreground">
          Everyone who has signed up, with their granted roles and staff record.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Staff record</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles?.map((p) => {
            const roles = (p.user_roles ?? []).map((r: { role: string }) => r.role);
            const staffRecord = p.staff as unknown as
              | { id: string; designation: string | null; staff_code: string | null }[]
              | null;
            const hasStaff = Array.isArray(staffRecord) && staffRecord.length > 0;

            return (
              <TableRow key={p.id}>
                <TableCell>{p.email}</TableCell>
                <TableCell>{roles.length ? roles.join(", ") : "none"}</TableCell>
                <TableCell>
                  {hasStaff ? staffRecord![0].designation ?? "Yes" : "—"}
                </TableCell>
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
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
