import { useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getSupabaseClient } from "@/lib/supabase/client";
import { InfoHelp } from "@/components/InfoHelp";
import { StatusBadge } from "@/components/StatusBadge";

type LinkRequest = {
  id: string;
  parent: { email: string } | null;
  student: { full_name: string; admission_no: string } | null;
  verification_status: string;
  verification_method: string;
  requested_at: string;
};

function ConfirmAction({
  trigger,
  title,
  description,
  actionLabel,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{actionLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function LinkRequestsQueue() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const { data: requests } = useQuery({
    queryKey: ["parent_link_requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_student_links")
        .select("*, parents(email), students(full_name, admission_no)")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map(
        (r): LinkRequest => ({
          id: r.id,
          parent: r.parents as unknown as { email: string } | null,
          student: r.students as unknown as { full_name: string; admission_no: string } | null,
          verification_status: r.verification_status,
          verification_method: r.verification_method,
          requested_at: r.requested_at,
        }),
      );
    },
  });

  async function review(linkId: string, decision: "verified" | "rejected") {
    setPendingAction(linkId);
    try {
      const { error } = await supabase.rpc("review_link_request", {
        p_link_id: linkId,
        p_decision: decision,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success(decision === "verified" ? "Request approved — parent can now view this child." : "Request rejected.");
      queryClient.invalidateQueries({ queryKey: ["parent_link_requests"] });
    } finally {
      setPendingAction(null);
    }
  }

  async function revokeLink(linkId: string) {
    setPendingAction(linkId);
    try {
      const { error } = await supabase.rpc("revoke_parent_link", { p_link_id: linkId });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Access revoked — this parent can no longer view this child.");
      queryClient.invalidateQueries({ queryKey: ["parent_link_requests"] });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">
            Parent Link Requests
          </h1>
          <p className="text-muted-foreground">
            Review a parent's request, confirm the relationship, and approve or reject it.
          </p>
        </div>
        <InfoHelp
          title="Parent Link Requests"
          content={{
            purpose:
              "When a parent asks to view a child's records (results, fees, payments), that request lands here first — they see nothing about the child until you approve it.",
            steps: [
              "Check the parent's email against the student's on-file guardian record.",
              "Select Approve if the relationship checks out, or Reject if it doesn't.",
              "If access needs to be removed later (even after approving), select Revoke.",
            ],
            rules: [
              "A parent sees absolutely nothing about a child until their request is approved — approving is what turns access on.",
              "Rejecting or revoking removes/denies access immediately; it does not delete the parent's account itself.",
              "Only the principal or accountant can approve, reject, or revoke a link.",
            ],
            nextSteps:
              "Once approved, the parent can immediately see that child's published results, fees, and payment history on their Family Dashboard — nothing else.",
          }}
        />
      </div>
      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Parent</TableHead>
              <TableHead>Child</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.parent?.email}</TableCell>
                <TableCell>
                  {r.student?.full_name} ({r.student?.admission_no})
                </TableCell>
                <TableCell className="capitalize text-sm text-muted-foreground">
                  {r.verification_method.replace("_", " ")}
                </TableCell>
                <TableCell>
                  <StatusBadge status={r.verification_status} />
                </TableCell>
                <TableCell>{new Date(r.requested_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    {r.verification_status === "pending" && (
                      <>
                        <ConfirmAction
                          trigger={
                            <Button size="sm" disabled={pendingAction === r.id}>
                              Approve
                            </Button>
                          }
                          title={`Approve this link to ${r.student?.full_name}?`}
                          description={`${r.parent?.email} will immediately be able to see this child's published results, fees, and payment history. Only do this once you've confirmed the relationship.`}
                          actionLabel="Approve"
                          onConfirm={() => review(r.id, "verified")}
                        />
                        <ConfirmAction
                          trigger={
                            <Button size="sm" variant="outline" disabled={pendingAction === r.id}>
                              Reject
                            </Button>
                          }
                          title="Reject this request?"
                          description="The parent will not gain any access to this child's records. They can submit a new request later if needed."
                          actionLabel="Reject"
                          onConfirm={() => review(r.id, "rejected")}
                        />
                      </>
                    )}
                    {r.verification_status === "verified" && (
                      <ConfirmAction
                        trigger={
                          <Button size="sm" variant="outline" disabled={pendingAction === r.id}>
                            Revoke
                          </Button>
                        }
                        title="Revoke this parent's access?"
                        description="This immediately removes the parent's ability to view this child's records. This does not delete their account."
                        actionLabel="Revoke"
                        onConfirm={() => revokeLink(r.id)}
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
