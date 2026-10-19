import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function LinkRequestsQueue() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const { data: requests } = useQuery({
    queryKey: ["parent_link_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_student_links")
        .select("*, parents(email), students(full_name, admission_no)")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function review(linkId: string, decision: "verified" | "rejected") {
    const { error } = await supabase.rpc("review_link_request", {
      p_link_id: linkId,
      p_decision: decision,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Request ${decision}`);
    queryClient.invalidateQueries({ queryKey: ["parent_link_requests"] });
  }

  async function revokeLink(linkId: string) {
    const { error } = await supabase.rpc("revoke_parent_link", { p_link_id: linkId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link revoked");
    queryClient.invalidateQueries({ queryKey: ["parent_link_requests"] });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">
          Parent Link Requests
        </h1>
        <p className="text-muted-foreground">
          Cross-check against the student's on-file guardian record before verifying.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parent</TableHead>
            <TableHead>Child</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests?.map((r) => {
            const parent = r.parents as unknown as { email: string } | null;
            const student = r.students as unknown as {
              full_name: string;
              admission_no: string;
            } | null;
            return (
              <TableRow key={r.id}>
                <TableCell>{parent?.email}</TableCell>
                <TableCell>
                  {student?.full_name} ({student?.admission_no})
                </TableCell>
                <TableCell className="capitalize">{r.verification_status}</TableCell>
                <TableCell>{new Date(r.requested_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  {r.verification_status === "pending" && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => review(r.id, "verified")}>
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => review(r.id, "rejected")}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                  {r.verification_status === "verified" && (
                    <Button size="sm" variant="outline" onClick={() => revokeLink(r.id)}>
                      Revoke
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
