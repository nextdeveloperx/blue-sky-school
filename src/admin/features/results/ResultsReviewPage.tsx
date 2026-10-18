import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function ResultsReviewPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [termId, setTermId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: currentYear } = useQuery({
    queryKey: ["current_academic_year"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: terms } = useQuery({
    queryKey: ["exam_terms", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_terms")
        .select("*")
        .eq("academic_year_id", currentYear!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: results } = useQuery({
    queryKey: ["results", termId],
    enabled: !!termId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("*, students(full_name, admission_no)")
        .eq("exam_term_id", termId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function computeResults() {
    const { data, error } = await supabase.rpc("compute_results", { p_exam_term_id: termId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Computed/refreshed ${data} result(s)`);
    queryClient.invalidateQueries({ queryKey: ["results", termId] });
  }

  async function approveSelected() {
    const { data, error } = await supabase.rpc("approve_results", {
      p_result_ids: Array.from(selected),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Approved ${data} result(s)`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["results", termId] });
  }

  async function rejectSelected() {
    const reason = window.prompt("Reason for rejecting these results?");
    if (!reason) return;
    const { data, error } = await supabase.rpc("reject_results", {
      p_result_ids: Array.from(selected),
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Rejected ${data} result(s)`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["results", termId] });
  }

  async function publishSelected() {
    const { data, error } = await supabase.rpc("publish_results", {
      p_result_ids: Array.from(selected),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Published ${data} result(s)`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["results", termId] });
  }

  async function reopen(resultId: string) {
    const reason = window.prompt("Reason for reopening this result for correction?");
    if (!reason) return;
    const { error } = await supabase.rpc("reopen_for_correction", {
      p_result_id: resultId,
      p_reason: reason,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Reopened for correction");
    queryClient.invalidateQueries({ queryKey: ["results", termId] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Results Review</h1>
        <p className="text-muted-foreground">
          Compute draft results, then approve or reject, then publish. Publishing is a deliberate
          second step after approval — parents only ever see published results.
        </p>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <Select value={termId} onValueChange={setTermId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Exam term" />
          </SelectTrigger>
          <SelectContent>
            {terms?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {termId && <Button onClick={computeResults}>Compute / refresh results</Button>}
      </div>

      {termId && (
        <>
          <div className="flex gap-2">
            <Button variant="outline" onClick={approveSelected} disabled={selected.size === 0}>
              Approve selected
            </Button>
            <Button variant="outline" onClick={rejectSelected} disabled={selected.size === 0}>
              Reject selected
            </Button>
            <Button onClick={publishSelected} disabled={selected.size === 0}>
              Publish selected
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead>Student</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results?.map((r) => {
                const student = r.students as unknown as {
                  full_name: string;
                  admission_no: string;
                } | null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={() => toggle(r.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {student?.full_name} ({student?.admission_no})
                    </TableCell>
                    <TableCell>
                      {r.total_obtained} / {r.total_max}
                    </TableCell>
                    <TableCell>{r.percentage?.toFixed(1)}</TableCell>
                    <TableCell>{r.overall_grade}</TableCell>
                    <TableCell>
                      {r.status}
                      {r.status === "rejected" && r.rejection_reason && (
                        <span className="text-muted-foreground text-xs block">
                          {r.rejection_reason}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {(r.status === "approved" || r.status === "published") && (
                        <Button variant="outline" size="sm" onClick={() => reopen(r.id)}>
                          Reopen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
