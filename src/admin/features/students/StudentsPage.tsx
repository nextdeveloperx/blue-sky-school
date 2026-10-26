import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
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
import { StatusBadge } from "@/components/StatusBadge";
import { RowActionsMenu, type RowAction } from "@/components/RowActionsMenu";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth/useSession";
import AddStudentDialog from "./AddStudentDialog";

type StudentRow = {
  id: string;
  full_name: string;
  admission_no: string;
  status: string;
  sections: { name: string; classes: { name: string } | null } | null;
};

type PendingAction =
  | { type: "archive"; student: StudentRow }
  | { type: "reactivate"; student: StudentRow }
  | { type: "delete"; student: StudentRow };

export default function StudentsPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const { roles } = useSession();
  const canManage = roles.includes("principal") || roles.includes("accountant");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [linkedRecordCount, setLinkedRecordCount] = useState<number | null>(null);
  const [isCheckingLinks, setIsCheckingLinks] = useState(false);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

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

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, sections(name, classes(name))")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = useMemo(() => {
    if (!students) return students;
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const sectionInfo = s.sections as unknown as {
        name: string;
        classes: { name: string } | null;
      } | null;
      const classSection = sectionInfo ? `${sectionInfo.classes?.name ?? ""} ${sectionInfo.name}` : "";
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        classSection.toLowerCase().includes(q)
      );
    });
  }, [students, search]);

  // A student is only ever safe to permanently delete if NOTHING references
  // them — fee dues, payments, marks, results, or a parent link. Every one
  // of those foreign keys is a plain (non-cascading) reference, so the
  // database itself would refuse the delete anyway; this check exists only
  // to give an honest, specific reason up front instead of a raw FK error.
  async function countLinkedRecords(studentId: string): Promise<number> {
    const [fees, payments, marks, results, links] = await Promise.all([
      supabase.from("fee_schedules").select("id", { count: "exact", head: true }).eq("student_id", studentId),
      supabase.from("payments").select("id", { count: "exact", head: true }).eq("student_id", studentId),
      supabase.from("marks").select("id", { count: "exact", head: true }).eq("student_id", studentId),
      supabase.from("results").select("id", { count: "exact", head: true }).eq("student_id", studentId),
      supabase.from("parent_student_links").select("id", { count: "exact", head: true }).eq("student_id", studentId),
    ]);
    return [fees, payments, marks, results, links].reduce((sum, r) => sum + (r.count ?? 0), 0);
  }

  async function openDeleteFlow(student: StudentRow) {
    setPendingAction({ type: "delete", student });
    setIsCheckingLinks(true);
    try {
      const count = await countLinkedRecords(student.id);
      setLinkedRecordCount(count);
    } catch {
      // If the check itself fails, fall back to the safe assumption (treat
      // as linked) rather than silently offering a permanent delete.
      setLinkedRecordCount(1);
    } finally {
      setIsCheckingLinks(false);
    }
  }

  function closeDialog() {
    setPendingAction(null);
    setLinkedRecordCount(null);
    setIsCheckingLinks(false);
  }

  async function runPendingAction() {
    if (!pendingAction) return;
    setIsSubmittingAction(true);
    try {
      if (pendingAction.type === "archive") {
        const { error } = await supabase
          .from("students")
          .update({ status: "inactive" })
          .eq("id", pendingAction.student.id);
        if (error) throw error;
        toast.success(`${pendingAction.student.full_name} archived`);
      } else if (pendingAction.type === "reactivate") {
        const { error } = await supabase
          .from("students")
          .update({ status: "active" })
          .eq("id", pendingAction.student.id);
        if (error) throw error;
        toast.success(`${pendingAction.student.full_name} reactivated`);
      } else {
        // Permanent delete — only reachable when linkedRecordCount === 0,
        // and the database's own foreign-key constraints are the final
        // backstop if that count is ever wrong.
        const { error } = await supabase.from("students").delete().eq("id", pendingAction.student.id);
        if (error) throw error;
        toast.success(`${pendingAction.student.full_name} permanently deleted`);
      }
      queryClient.invalidateQueries({ queryKey: ["students"] });
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmittingAction(false);
    }
  }

  function actionsFor(s: StudentRow): RowAction[] {
    if (!canManage) return [];
    if (s.status === "inactive") {
      return [
        {
          label: "Reactivate",
          onSelect: () => setPendingAction({ type: "reactivate", student: s }),
        },
        {
          label: "Delete student",
          destructive: true,
          separatorBefore: true,
          onSelect: () => openDeleteFlow(s),
        },
      ];
    }
    return [
      {
        label: "Archive student",
        onSelect: () => setPendingAction({ type: "archive", student: s }),
      },
      {
        label: "Delete student",
        destructive: true,
        separatorBefore: true,
        onSelect: () => openDeleteFlow(s),
      },
    ];
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Students</h1>
          <p className="text-muted-foreground">Admission and records.</p>
        </div>
        {currentYear && <AddStudentDialog academicYearId={currentYear.id} />}
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">
          Create an academic year under Academic Setup before admitting students.
        </p>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, admission no., or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      {students && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredStudents?.length ?? 0} of {students.length} students
        </p>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Admission No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class / Section</TableHead>
              <TableHead>Status</TableHead>
              {canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents?.map((s) => {
              const sectionInfo = s.sections as unknown as {
                name: string;
                classes: { name: string } | null;
              } | null;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.admission_no}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>
                    {sectionInfo ? `${sectionInfo.classes?.name} - ${sectionInfo.name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <RowActionsMenu label={s.full_name} actions={actionsFor(s as unknown as StudentRow)} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent>
          {pendingAction?.type === "archive" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {pendingAction.student.full_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  The student is marked inactive and removed from active counts and most lists, but their
                  fee, payment, marks, and result history is fully preserved. You can reactivate them later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runPendingAction} disabled={isSubmittingAction}>
                  {isSubmittingAction ? "Archiving…" : "Archive student"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {pendingAction?.type === "reactivate" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Reactivate {pendingAction.student.full_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Marks the student active again, visible in active lists and counts.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={runPendingAction} disabled={isSubmittingAction}>
                  {isSubmittingAction ? "Reactivating…" : "Reactivate"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
          {pendingAction?.type === "delete" && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {pendingAction.student.full_name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {isCheckingLinks
                    ? "Checking for linked fee, payment, marks, result, and parent-link records…"
                    : linkedRecordCount && linkedRecordCount > 0
                      ? `This student has ${linkedRecordCount} linked record(s) (fees, payments, marks, results, or a parent link). Deleting would destroy financial or academic history, so permanent deletion is blocked. Archive instead to remove them from active lists while keeping their history.`
                      : "No linked fee, payment, marks, result, or parent-link records were found. This permanently removes the student record and cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={closeDialog}>Cancel</AlertDialogCancel>
                {!isCheckingLinks && linkedRecordCount !== null && linkedRecordCount > 0 ? (
                  <AlertDialogAction
                    onClick={() => {
                      const student = pendingAction.student;
                      closeDialog();
                      setPendingAction({ type: "archive", student });
                    }}
                  >
                    Archive instead
                  </AlertDialogAction>
                ) : (
                  <AlertDialogAction
                    onClick={runPendingAction}
                    disabled={isCheckingLinks || isSubmittingAction}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isSubmittingAction ? "Deleting…" : "Delete permanently"}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
