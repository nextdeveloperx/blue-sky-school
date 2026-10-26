import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { getSupabaseClient } from "@/lib/supabase/client";
import { InfoHelp } from "@/components/InfoHelp";
import { StatusBadge } from "@/components/StatusBadge";
import { RowActionsMenu, type RowAction } from "@/components/RowActionsMenu";
import { useSession } from "@/lib/auth/useSession";
import {
  RESULT_STATUSES,
  RESULT_STATUS_EXPLANATIONS,
  RESULT_STATUS_LABELS,
  filterResultRows,
  type ResultStatus,
} from "@/lib/results/resultsHelpers";

type StudentInfo = {
  full_name: string;
  admission_no: string;
  current_section_id: string;
  sections: { name: string; class_id: string; classes: { name: string } | null } | null;
} | null;

type ResultRow = {
  id: string;
  student_id: string;
  total_obtained: number | null;
  total_max: number | null;
  percentage: number | null;
  overall_grade: string | null;
  status: ResultStatus;
  rejection_reason: string | null;
  students: StudentInfo;
};

type PendingAction =
  | { type: "approve"; resultIds: string[]; summary: string }
  | { type: "reject"; resultIds: string[]; summary: string }
  | { type: "publish"; resultIds: string[]; summary: string }
  | { type: "reopen"; resultIds: string[]; summary: string };

const ACTION_COPY: Record<
  PendingAction["type"],
  { title: string; description: string; actionLabel: string; needsReason: boolean }
> = {
  approve: {
    title: "Approve this result?",
    description: "The teacher will no longer be able to edit marks for this term. Approved results are ready to publish.",
    actionLabel: "Approve",
    needsReason: false,
  },
  reject: {
    title: "Reject this result?",
    description: "Sends it back with a reason instead of approving it. The teacher can still correct marks and recompute afterward.",
    actionLabel: "Reject",
    needsReason: true,
  },
  publish: {
    title: "Publish this result?",
    description: "The student's verified parent will immediately be able to see it on the Family Dashboard.",
    actionLabel: "Publish",
    needsReason: false,
  },
  reopen: {
    title: "Reopen for correction?",
    description: "Sends this result back to draft so the teacher can fix marks. This is logged with your reason.",
    actionLabel: "Reopen",
    needsReason: true,
  },
};

export default function ResultsReviewPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const { roles } = useSession();
  const isPrincipal = roles.includes("principal");

  const [academicYearId, setAcademicYearId] = useState("");
  const [termId, setTermId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<ResultStatus | "all">("all");
  const [studentQuery, setStudentQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  const {
    data: academicYears,
    isLoading: yearsLoading,
    isError: yearsError,
  } = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const effectiveYearId = academicYearId || academicYears?.find((y) => y.is_current)?.id || "";

  const { data: terms, isLoading: termsLoading } = useQuery({
    queryKey: ["exam_terms", effectiveYearId],
    enabled: !!effectiveYearId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_terms")
        .select("*")
        .eq("academic_year_id", effectiveYearId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes", effectiveYearId],
    enabled: !!effectiveYearId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("academic_year_id", effectiveYearId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: sections } = useQuery({
    queryKey: ["sections", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*")
        .eq("class_id", classId)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const {
    data: results,
    isLoading: resultsLoading,
    isError: resultsError,
  } = useQuery({
    queryKey: ["results", termId],
    enabled: !!termId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("*, students(full_name, admission_no, current_section_id, sections(name, class_id, classes(name)))")
        .eq("exam_term_id", termId)
        .order("created_at");
      if (error) throw error;
      return data as unknown as ResultRow[];
    },
  });

  const filteredResults = useMemo(() => {
    const rows = (results ?? []).map((r) => ({
      id: r.id,
      student_name: r.students?.full_name ?? "",
      admission_no: r.students?.admission_no ?? "",
      class_id: r.students?.sections?.class_id ?? null,
      section_id: r.students?.current_section_id ?? null,
      status: r.status,
    }));
    const filteredIds = new Set(
      filterResultRows(rows, { classId: classId || undefined, sectionId: sectionId || undefined, status: statusFilter, studentQuery }).map(
        (r) => r.id,
      ),
    );
    return (results ?? []).filter((r) => filteredIds.has(r.id));
  }, [results, classId, sectionId, statusFilter, studentQuery]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const visibleIds = filteredResults.map((r) => r.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
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

  function closeDialog() {
    setPendingAction(null);
    setReason("");
  }

  async function runPendingAction() {
    if (!pendingAction) return;
    const copy = ACTION_COPY[pendingAction.type];
    if (copy.needsReason && !reason.trim()) {
      toast.error("A reason is required");
      return;
    }

    setIsSubmittingAction(true);
    try {
      if (pendingAction.type === "approve") {
        const { data, error } = await supabase.rpc("approve_results", { p_result_ids: pendingAction.resultIds });
        if (error) throw error;
        toast.success(`Approved ${data} result(s)`);
      } else if (pendingAction.type === "reject") {
        const { data, error } = await supabase.rpc("reject_results", {
          p_result_ids: pendingAction.resultIds,
          p_reason: reason.trim(),
        });
        if (error) throw error;
        toast.success(`Rejected ${data} result(s)`);
      } else if (pendingAction.type === "publish") {
        const { data, error } = await supabase.rpc("publish_results", { p_result_ids: pendingAction.resultIds });
        if (error) throw error;
        toast.success(`Published ${data} result(s)`);
      } else {
        for (const resultId of pendingAction.resultIds) {
          const { error } = await supabase.rpc("reopen_for_correction", {
            p_result_id: resultId,
            p_reason: reason.trim(),
          });
          if (error) throw error;
        }
        toast.success("Reopened for correction");
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["results", termId] });
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  function rowActionsFor(r: ResultRow): RowAction[] {
    if (!isPrincipal) return [];
    const studentName = r.students?.full_name ?? "this student";
    const actions: RowAction[] = [];
    if (r.status === "draft") {
      actions.push({
        label: "Approve",
        onSelect: () => setPendingAction({ type: "approve", resultIds: [r.id], summary: studentName }),
      });
      actions.push({
        label: "Reject",
        onSelect: () => setPendingAction({ type: "reject", resultIds: [r.id], summary: studentName }),
      });
    }
    if (r.status === "approved") {
      actions.push({
        label: "Publish",
        onSelect: () => setPendingAction({ type: "publish", resultIds: [r.id], summary: studentName }),
      });
      actions.push({
        label: "Reopen for correction",
        onSelect: () => setPendingAction({ type: "reopen", resultIds: [r.id], summary: studentName }),
        separatorBefore: true,
      });
    }
    if (r.status === "published") {
      actions.push({
        label: "Reopen for correction",
        onSelect: () => setPendingAction({ type: "reopen", resultIds: [r.id], summary: studentName }),
      });
    }
    return actions;
  }

  const activeCopy = pendingAction ? ACTION_COPY[pendingAction.type] : null;
  const allVisibleSelected =
    filteredResults.length > 0 && filteredResults.every((r) => selected.has(r.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Results Review</h1>
          <p className="text-muted-foreground">
            Calculate results, review them, then approve and publish.
          </p>
        </div>
        <InfoHelp
          title="Results Review"
          content={{
            purpose:
              "Turn the marks teachers have entered into a final result per student — a total, percentage, and grade — then control when parents are allowed to see it.",
            steps: [
              "Pick an academic year and exam term, then select \"Compute / refresh results\" to total up every student's entered marks.",
              "Use the filters to narrow the table to a class, section, status, or a specific student.",
              "Review the draft totals, then Approve or Reject each result (with a reason) from its row menu, or select several and act on them together.",
              "Once approved, Publish — this is the moment parents can see the result.",
            ],
            rules: [
              `${RESULT_STATUS_LABELS.draft}: ${RESULT_STATUS_EXPLANATIONS.draft}`,
              `${RESULT_STATUS_LABELS.approved}: ${RESULT_STATUS_EXPLANATIONS.approved}`,
              `${RESULT_STATUS_LABELS.rejected}: ${RESULT_STATUS_EXPLANATIONS.rejected}`,
              `${RESULT_STATUS_LABELS.published}: ${RESULT_STATUS_EXPLANATIONS.published}`,
              "Only the principal can approve, reject, publish, or reopen a result — a teacher or accountant can only view.",
              "Once a student's result is approved or published, the teacher can no longer edit that student's marks for this term — only the principal can reopen it for correction.",
              "Class and section shown here reflect each student's current section, not necessarily the section they were in when this exam term ran.",
            ],
            nextSteps:
              "Published results immediately become visible to the student's verified parent on their Family Dashboard.",
          }}
        />
      </div>

      <section className="card-elevated p-4 space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <Select
            value={effectiveYearId}
            onValueChange={(v) => {
              setAcademicYearId(v);
              setTermId("");
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Academic year" />
            </SelectTrigger>
            <SelectContent>
              {academicYears?.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={termId} onValueChange={setTermId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={termsLoading ? "Loading terms…" : "Exam term"} />
            </SelectTrigger>
            <SelectContent>
              {terms?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {termId && isPrincipal && <Button onClick={computeResults}>Compute / refresh results</Button>}
        </div>

        {yearsError && (
          <p className="text-sm text-destructive" role="alert">
            Could not load academic years — try refreshing the page.
          </p>
        )}

        {termId && (
          <div className="flex gap-2 items-end flex-wrap pt-2 border-t border-border">
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                {classes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sectionId} onValueChange={setSectionId} disabled={!classId}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                {sections?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ResultStatus | "all")}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {RESULT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESULT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search student name or admission no."
              className="w-60"
              value={studentQuery}
              onChange={(e) => setStudentQuery(e.target.value)}
            />
            {(classId || sectionId || statusFilter !== "all" || studentQuery) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setClassId("");
                  setSectionId("");
                  setStatusFilter("all");
                  setStudentQuery("");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </section>

      {termId && (
        <section className="card-elevated p-4 space-y-3">
          {isPrincipal && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() =>
                  setPendingAction({ type: "approve", resultIds: Array.from(selected), summary: `${selected.size} result(s)` })
                }
                disabled={selected.size === 0}
              >
                Approve selected
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  setPendingAction({ type: "reject", resultIds: Array.from(selected), summary: `${selected.size} result(s)` })
                }
                disabled={selected.size === 0}
              >
                Reject selected
              </Button>
              <Button
                onClick={() =>
                  setPendingAction({ type: "publish", resultIds: Array.from(selected), summary: `${selected.size} result(s)` })
                }
                disabled={selected.size === 0}
              >
                Publish selected
              </Button>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isPrincipal && (
                    <TableHead className="w-10">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Select all visible results" />
                    </TableHead>
                  )}
                  <TableHead>Student</TableHead>
                  <TableHead>Class / Section</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  {isPrincipal && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultsError ? (
                  <TableRow>
                    <TableCell colSpan={isPrincipal ? 8 : 6} className="text-center text-destructive py-8" role="alert">
                      Could not load results for this term — try refreshing the page.
                    </TableCell>
                  </TableRow>
                ) : resultsLoading ? (
                  <TableRow>
                    <TableCell colSpan={isPrincipal ? 8 : 6} className="text-center text-muted-foreground py-8">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filteredResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isPrincipal ? 8 : 6} className="text-center text-muted-foreground py-8">
                      {results && results.length > 0
                        ? "No results match the current filters."
                        : "No results yet — compute results for this term to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResults.map((r) => {
                    const student = r.students;
                    const className = student?.sections?.classes?.name;
                    const sectionName = student?.sections?.name;
                    return (
                      <TableRow key={r.id}>
                        {isPrincipal && (
                          <TableCell>
                            <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                          </TableCell>
                        )}
                        <TableCell>
                          {student?.full_name} <span className="text-muted-foreground">({student?.admission_no})</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {className && sectionName ? `${className} - ${sectionName}` : "—"}
                        </TableCell>
                        <TableCell>
                          {r.total_obtained ?? "—"} / {r.total_max ?? "—"}
                        </TableCell>
                        <TableCell>{r.percentage != null ? r.percentage.toFixed(1) : "—"}</TableCell>
                        <TableCell>{r.overall_grade ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                          {r.status === "rejected" && r.rejection_reason && (
                            <span className="text-muted-foreground text-xs block mt-1">{r.rejection_reason}</span>
                          )}
                        </TableCell>
                        {isPrincipal && (
                          <TableCell>
                            <RowActionsMenu label={student?.full_name ?? "result"} actions={rowActionsFor(r)} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent>
          {activeCopy && pendingAction && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{activeCopy.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {pendingAction.summary} — {activeCopy.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {activeCopy.needsReason && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Reason (required)</label>
                  <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
                </div>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runPendingAction} disabled={isSubmittingAction}>
                  {isSubmittingAction ? "Working…" : activeCopy.actionLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
