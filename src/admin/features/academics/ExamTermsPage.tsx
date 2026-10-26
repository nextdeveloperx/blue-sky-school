import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseClient } from "@/lib/supabase/client";
import { InfoHelp } from "@/components/InfoHelp";
import { StatusBadge } from "@/components/StatusBadge";
import { RowActionsMenu, type RowAction } from "@/components/RowActionsMenu";
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

type ExamTerm = { id: string; name: string; status: string };
type GradeBand = { id: string; min_percent: number; max_percent: number; grade_label: string };

export default function ExamTermsPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

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
        .eq("academic_year_id", currentYear!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: bands } = useQuery({
    queryKey: ["grade_scale", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_scale")
        .select("*")
        .eq("academic_year_id", currentYear!.id)
        .order("min_percent", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [termName, setTermName] = useState("");
  const [minPercent, setMinPercent] = useState("");
  const [maxPercent, setMaxPercent] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [deleteTermTarget, setDeleteTermTarget] = useState<ExamTerm | null>(null);
  const [deleteTermGuard, setDeleteTermGuard] = useState<number | null>(null);
  const [deleteBandTarget, setDeleteBandTarget] = useState<GradeBand | null>(null);
  const [deleteBandGuard, setDeleteBandGuard] = useState<number | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);

  async function createTerm() {
    if (!currentYear || !termName) {
      toast.error("Term name is required");
      return;
    }
    const { error } = await supabase
      .from("exam_terms")
      .insert({ academic_year_id: currentYear.id, name: termName });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Exam term created");
    setTermName("");
    queryClient.invalidateQueries({ queryKey: ["exam_terms", currentYear.id] });
  }

  async function createBand() {
    if (!currentYear || !minPercent || !maxPercent || !gradeLabel) {
      toast.error("Min %, max %, and grade label are required");
      return;
    }
    const min = Number(minPercent);
    const max = Number(maxPercent);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
      toast.error("Enter a valid range between 0 and 100 (min ≤ max)");
      return;
    }
    const overlapping = bands?.some((b) => min <= b.max_percent && max >= b.min_percent);
    if (overlapping) {
      toast.error("This range overlaps an existing grade band — adjust it first");
      return;
    }
    const { error } = await supabase.from("grade_scale").insert({
      academic_year_id: currentYear.id,
      min_percent: min,
      max_percent: max,
      grade_label: gradeLabel,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Grade band added");
    setMinPercent("");
    setMaxPercent("");
    setGradeLabel("");
    queryClient.invalidateQueries({ queryKey: ["grade_scale", currentYear.id] });
  }

  async function openDeleteTermFlow(term: ExamTerm) {
    setDeleteTermTarget(term);
    setIsCheckingDelete(true);
    try {
      const [marks, results] = await Promise.all([
        supabase.from("marks").select("id", { count: "exact", head: true }).eq("exam_term_id", term.id),
        supabase.from("results").select("id", { count: "exact", head: true }).eq("exam_term_id", term.id),
      ]);
      setDeleteTermGuard((marks.count ?? 0) + (results.count ?? 0));
    } catch {
      setDeleteTermGuard(1);
    } finally {
      setIsCheckingDelete(false);
    }
  }

  async function closeTerm(term: ExamTerm) {
    const { error } = await supabase.from("exam_terms").update({ status: "locked" }).eq("id", term.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${term.name} closed — marks/results are preserved, no further marks entry is expected`);
    setDeleteTermTarget(null);
    queryClient.invalidateQueries({ queryKey: ["exam_terms", currentYear?.id] });
  }

  async function deleteTermPermanently() {
    if (!deleteTermTarget) return;
    const { error } = await supabase.from("exam_terms").delete().eq("id", deleteTermTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${deleteTermTarget.name} deleted`);
    setDeleteTermTarget(null);
    queryClient.invalidateQueries({ queryKey: ["exam_terms", currentYear?.id] });
  }

  async function openDeleteBandFlow(band: GradeBand) {
    setDeleteBandTarget(band);
    setIsCheckingDelete(true);
    try {
      const { count, error } = await supabase
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("overall_grade", band.grade_label);
      if (error) throw error;
      setDeleteBandGuard(count ?? 0);
    } catch {
      setDeleteBandGuard(1);
    } finally {
      setIsCheckingDelete(false);
    }
  }

  async function deleteBandPermanently() {
    if (!deleteBandTarget) return;
    const { error } = await supabase.from("grade_scale").delete().eq("id", deleteBandTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Grade band removed");
    setDeleteBandTarget(null);
    queryClient.invalidateQueries({ queryKey: ["grade_scale", currentYear?.id] });
  }

  function closeDeleteDialogs() {
    setDeleteTermTarget(null);
    setDeleteTermGuard(null);
    setDeleteBandTarget(null);
    setDeleteBandGuard(null);
    setIsCheckingDelete(false);
  }

  function termActions(t: ExamTerm): RowAction[] {
    if (t.status === "locked") return [];
    return [{ label: "Delete / Close term", destructive: true, onSelect: () => openDeleteTermFlow(t) }];
  }

  function bandActions(b: GradeBand): RowAction[] {
    return [{ label: "Delete band", destructive: true, onSelect: () => openDeleteBandFlow(b) }];
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">
            Exam Terms &amp; Grade Scale
          </h1>
          <p className="text-muted-foreground">
            Terms (e.g. Term 1, Annual) and the percentage-to-grade bands used when results are
            computed.
          </p>
        </div>
        <InfoHelp
          title="Exam Terms & Grade Scale"
          content={{
            purpose:
              "An exam term (like \"Term 1\") is what marks and results are grouped under. The grade scale decides which letter grade a percentage turns into when results are calculated.",
            steps: [
              "Add a term name (e.g. \"Term 1\", \"Annual Exam\") to start collecting marks for it.",
              "Add grade bands as a minimum %, maximum %, and the grade letter for that range (e.g. 90-100 = A1).",
            ],
            rules: [
              "Status shown here (\"open\"/\"locked\") is informational only right now — it does not yet stop a teacher from entering or changing marks. The actual protection is on each student's individual result: once the principal approves or publishes it, that student's marks lock automatically and only the principal can reopen them for correction.",
              "Grade bands apply to every result calculated under this academic year, including ones already computed — adding or changing a band can change grades on existing results the next time they're recalculated.",
            ],
            nextSteps:
              "Teachers enter marks against the term you create here; grades shown on results come from whichever band the final percentage falls into.",
          }}
        />
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">Create an academic year first.</p>
      )}

      {currentYear && (
        <>
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Exam Terms</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      <RowActionsMenu label={t.name} actions={termActions(t as unknown as ExamTerm)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <Input
                placeholder="Term name (e.g. Term 1)"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
              />
              <Button onClick={createTerm}>Add term</Button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Grade Scale</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Min %</TableHead>
                  <TableHead>Max %</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {bands?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.min_percent}</TableCell>
                    <TableCell>{b.max_percent}</TableCell>
                    <TableCell>{b.grade_label}</TableCell>
                    <TableCell>
                      <RowActionsMenu label={b.grade_label} actions={bandActions(b as unknown as GradeBand)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <Input
                type="number"
                placeholder="Min %"
                className="w-24"
                value={minPercent}
                onChange={(e) => setMinPercent(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max %"
                className="w-24"
                value={maxPercent}
                onChange={(e) => setMaxPercent(e.target.value)}
              />
              <Input
                placeholder="Grade (e.g. A1)"
                className="w-32"
                value={gradeLabel}
                onChange={(e) => setGradeLabel(e.target.value)}
              />
              <Button onClick={createBand}>Add band</Button>
            </div>
          </section>
        </>
      )}

      <AlertDialog open={!!deleteTermTarget} onOpenChange={(open) => !open && closeDeleteDialogs()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTermTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingDelete
                ? "Checking whether any marks or results reference this term…"
                : deleteTermGuard && deleteTermGuard > 0
                  ? "Marks or results already exist for this term, so deleting it would invalidate historical academic records — that's blocked. Closing it instead marks it locked, keeps everything on record, and signals it's no longer open for new marks entry."
                  : "No marks or results reference this term yet. It can be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialogs}>Cancel</AlertDialogCancel>
            {!isCheckingDelete && deleteTermGuard !== null && deleteTermGuard > 0 ? (
              <AlertDialogAction onClick={() => deleteTermTarget && closeTerm(deleteTermTarget)}>
                Close term instead
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={deleteTermPermanently}
                disabled={isCheckingDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete permanently
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteBandTarget} onOpenChange={(open) => !open && closeDeleteDialogs()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove grade band {deleteBandTarget?.grade_label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingDelete
                ? "Checking whether any computed results use this grade…"
                : deleteBandGuard && deleteBandGuard > 0
                  ? `${deleteBandGuard} existing result(s) already show "${deleteBandTarget?.grade_label}". Removing this band would leave those historical grades without a defined range behind them, so deletion is blocked to preserve the record.`
                  : "No computed results currently show this grade. It can be safely removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialogs}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteBandPermanently}
              disabled={isCheckingDelete || !!(deleteBandGuard && deleteBandGuard > 0)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete band
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
