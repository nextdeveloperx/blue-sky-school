import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Receipt } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ChartTypeSwitcher, type ChartDatum } from "@/components/charts/ChartTypeSwitcher";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatMinor } from "@/lib/finance/money";
import { computeExpenseTotals } from "@/lib/expenses/expenseHelpers";
import { useSession } from "@/lib/auth/useSession";

const feeChartConfig = {
  paid: { label: "Paid", color: "hsl(var(--chart-1))" },
  partial: { label: "Partial", color: "hsl(var(--chart-2))" },
  pending: { label: "Pending", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-elevated p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading font-bold text-2xl text-foreground">{value}</p>
    </div>
  );
}

interface StudentRow {
  id: string;
  status: string;
  admission_no: string;
  full_name: string;
  class_id: string | null;
  class_name: string | null;
  section_name: string | null;
  sort_order: number;
}

interface FeeScheduleRow {
  status: string;
  amount_due_minor: number;
  period_month: string;
  class_id: string | null;
  class_name: string | null;
  sort_order: number;
  student_name: string;
  admission_no: string;
}

const DashboardPage = () => {
  const supabase = getSupabaseClient();
  const { roles, loading: rolesLoading } = useSession();
  // Dashboard financial visibility, resolved from the server-verified role
  // list (useSession reads user_roles via RLS) — never a client-editable
  // flag or a username check. "Fee collection by class" is principal-only
  // per product requirement, even though accountant can see the same data
  // on the dedicated Fees/Payments pages elsewhere in the app; the other
  // financial bits here (expense total/shortcut) follow the same
  // principal-or-accountant boundary already enforced on the Expenses page
  // itself (see canManageExpenses). While roles are still loading, nothing
  // gated renders — avoids a flash of principal-only content to a teacher
  // before the role check resolves.
  const isPrincipal = !rolesLoading && roles.includes("principal");
  const canSeeFinancials = !rolesLoading && (roles.includes("principal") || roles.includes("accountant"));

  const { data: academicYears, isLoading: academicYearsLoading } = useQuery({
    queryKey: ["dashboard_academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("id, label, is_current")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const effectiveYearId = selectedYearId || academicYears?.find((y) => y.is_current)?.id || "";

  const {
    data: students,
    isLoading: studentsLoading,
    isError: studentsError,
  } = useQuery({
    queryKey: ["dashboard_students", effectiveYearId],
    enabled: !!effectiveYearId,
    queryFn: async (): Promise<StudentRow[]> => {
      const { data, error } = await supabase
        .from("students")
        .select("id, status, admission_no, full_name, sections(name, classes(id, name, sort_order))")
        .eq("academic_year_id", effectiveYearId);
      if (error) throw error;
      return (data ?? []).map((s) => {
        const section = s.sections as unknown as {
          name: string;
          classes: { id: string; name: string; sort_order: number } | null;
        } | null;
        return {
          id: s.id,
          status: s.status,
          admission_no: s.admission_no,
          full_name: s.full_name,
          class_id: section?.classes?.id ?? null,
          class_name: section?.classes?.name ?? null,
          section_name: section?.name ?? null,
          sort_order: section?.classes?.sort_order ?? 0,
        };
      });
    },
  });

  const { data: staffCount, isLoading: staffCountLoading } = useQuery({
    queryKey: ["dashboard_staff_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("staff")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: enquiryCount } = useQuery({
    queryKey: ["dashboard_enquiries"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("admission_enquiries")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) {
        // Table may not exist yet if that migration hasn't been applied.
        return null;
      }
      return count ?? 0;
    },
  });

  const {
    data: feeSchedules,
    isLoading: feeSchedulesLoading,
    isError: feeSchedulesError,
  } = useQuery({
    queryKey: ["dashboard_fee_schedules", effectiveYearId],
    // Gate the fetch itself, not just the rendered chart: fee_schedules RLS
    // actually lets a teacher read rows for their own assigned students
    // (see migration 13), so an unguarded query here would pull real
    // (partial) fee data into a teacher's browser even if the chart were
    // hidden client-side afterward.
    enabled: isPrincipal && !!effectiveYearId,
    queryFn: async (): Promise<FeeScheduleRow[]> => {
      const { data, error } = await supabase
        .from("fee_schedules")
        .select(
          "status, amount_due_minor, period_month, students!inner(full_name, admission_no, academic_year_id, sections(classes(id, name, sort_order)))",
        )
        .eq("students.academic_year_id", effectiveYearId);
      if (error) throw error;
      return (data ?? []).map((row) => {
        const student = row.students as unknown as {
          full_name: string;
          admission_no: string;
          sections: { classes: { id: string; name: string; sort_order: number } | null } | null;
        };
        const cls = student.sections?.classes ?? null;
        return {
          status: row.status,
          amount_due_minor: row.amount_due_minor,
          period_month: row.period_month,
          class_id: cls?.id ?? null,
          class_name: cls?.name ?? null,
          sort_order: cls?.sort_order ?? 0,
          student_name: student.full_name,
          admission_no: student.admission_no,
        };
      });
    },
  });

  const studentsByClassChart: ChartDatum[] = useMemo(() => {
    const counts = new Map<string, { name: string; sort: number; value: number }>();
    for (const s of students ?? []) {
      if (!s.class_id || !s.class_name) continue;
      const existing = counts.get(s.class_id) ?? { name: s.class_name, sort: s.sort_order, value: 0 };
      existing.value += 1;
      counts.set(s.class_id, existing);
    }
    return [...counts.values()].sort((a, b) => a.sort - b.sort);
  }, [students]);

  const feeByClassStacked = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; sort: number; paid: number; partial: number; pending: number }
    >();
    for (const row of feeSchedules ?? []) {
      if (!row.class_id || !row.class_name) continue;
      const existing =
        counts.get(row.class_id) ?? { name: row.class_name, sort: row.sort_order, paid: 0, partial: 0, pending: 0 };
      if (row.status === "paid") existing.paid += 1;
      else if (row.status === "partial") existing.partial += 1;
      else existing.pending += 1;
      counts.set(row.class_id, existing);
    }
    return [...counts.values()].sort((a, b) => a.sort - b.sort);
  }, [feeSchedules]);

  const outstandingByClassChart: ChartDatum[] = useMemo(() => {
    const totals = new Map<string, { name: string; sort: number; value: number }>();
    for (const row of feeSchedules ?? []) {
      if (!row.class_id || !row.class_name || row.status === "paid") continue;
      const existing = totals.get(row.class_id) ?? { name: row.class_name, sort: row.sort_order, value: 0 };
      existing.value += row.amount_due_minor;
      totals.set(row.class_id, existing);
    }
    return [...totals.values()].sort((a, b) => a.sort - b.sort).map((t) => ({ name: t.name, value: t.value }));
  }, [feeSchedules]);

  const activeStudents = students?.filter((s) => s.status === "active").length ?? 0;

  // React Query reports `isLoading: false` for a disabled query (not yet
  // enabled, as opposed to loaded-and-empty) — so while academicYears is
  // still resolving (and these queries are therefore disabled via
  // `enabled: !!effectiveYearId`), their own isLoading flag alone would
  // read as "not loading", showing an empty state instead of a loading one.
  const studentsSectionLoading = academicYearsLoading || studentsLoading;
  const feeSectionLoading = academicYearsLoading || feeSchedulesLoading;

  const { data: expenses } = useQuery({
    queryKey: ["dashboard_expenses"],
    enabled: canSeeFinancials,
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("amount_minor, incurred_on, voided_at");
      if (error) throw error;
      return data;
    },
  });

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const expenseTotals = useMemo(
    () => computeExpenseTotals(expenses ?? [], { today, monthPrefix: today.slice(0, 7) }),
    [expenses, today],
  );

  // Drill-down: clicking a chart bar/slice opens a small dialog listing the
  // underlying records for that class, built from data already fetched
  // above — no extra network round-trip.
  const [studentDrill, setStudentDrill] = useState<string | null>(null);
  const [feeDrill, setFeeDrill] = useState<string | null>(null);

  const drillStudents = studentDrill ? (students ?? []).filter((s) => s.class_name === studentDrill) : [];
  const drillFees = feeDrill
    ? (feeSchedules ?? []).filter((f) => f.class_name === feeDrill && f.status !== "paid")
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Principal Dashboard</h1>
          <p className="text-muted-foreground">An overview of the school, updated live from the database.</p>
        </div>
        <div className="flex items-center gap-2">
          {academicYears && academicYears.length > 0 && (
            <Select value={effectiveYearId} onValueChange={setSelectedYearId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Academic year" />
              </SelectTrigger>
              <SelectContent>
                {academicYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>
                    {y.label}
                    {y.is_current ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canSeeFinancials && (
            <Button asChild variant="outline">
              <Link to="/admin/expenses">
                <Receipt className="w-4 h-4" />
                Daily Expenses
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 ${canSeeFinancials ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <StatCard label="Active students" value={studentsSectionLoading ? "…" : studentsError ? "—" : activeStudents} />
        <StatCard label="Active staff" value={staffCountLoading ? "…" : staffCount ?? "—"} />
        <StatCard label="New enquiries" value={enquiryCount ?? "—"} />
        {canSeeFinancials && (
          <Link to="/admin/expenses" className="block">
            <StatCard label="Today's expenses" value={formatMinor(expenseTotals.todayTotalMinor)} />
          </Link>
        )}
      </div>

      <ChartTypeSwitcher
        title="Students by class"
        description="How enrolment compares across every class (both sections combined). Click a value to see the students."
        data={studentsByClassChart}
        valueLabel="Students"
        onElementClick={setStudentDrill}
        emptyMessage="No students yet for this academic year."
        isLoading={studentsSectionLoading}
        isError={studentsError}
      />

      {isPrincipal && (
        <>
          <section className="card-elevated p-4 space-y-2">
            <h2 className="font-heading font-semibold text-lg">Fee collection status by class</h2>
            <p className="text-sm text-muted-foreground">
              Paid / partial / pending fee-schedule counts, compared across every class.
            </p>
            {feeSectionLoading ? (
              <p className="text-sm text-muted-foreground py-8 text-center" role="status">
                Loading…
              </p>
            ) : feeSchedulesError ? (
              <p className="text-sm text-destructive py-8 text-center" role="alert">
                Could not load fee data — try refreshing the page.
              </p>
            ) : feeByClassStacked.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fee schedules generated yet.</p>
            ) : (
              <ChartContainer config={feeChartConfig} className="max-h-72 w-full">
                <BarChart data={feeByClassStacked}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="paid" stackId="fee" fill="var(--color-paid)" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="partial" stackId="fee" fill="var(--color-partial)" />
                  <Bar dataKey="pending" stackId="fee" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            )}
          </section>

          <ChartTypeSwitcher
            title="Outstanding fees by class"
            description="Total amount still due (partial + pending), compared across every class. Click a value to see the individual dues."
            data={outstandingByClassChart}
            valueLabel="Outstanding"
            valueFormatter={(v) => formatMinor(v)}
            onElementClick={setFeeDrill}
            emptyMessage="No outstanding dues — everything generated so far is fully paid."
            isLoading={feeSectionLoading}
            isError={feeSchedulesError}
          />
        </>
      )}

      <Dialog open={!!studentDrill} onOpenChange={(open) => !open && setStudentDrill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Students in {studentDrill}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Admission No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillStudents.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.admission_no}</TableCell>
                    <TableCell>{s.full_name}</TableCell>
                    <TableCell>{s.section_name}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!feeDrill} onOpenChange={(open) => !open && setFeeDrill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Outstanding dues in {feeDrill}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Student</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillFees.map((f, i) => (
                  <TableRow key={`${f.admission_no}-${f.period_month}-${i}`}>
                    <TableCell>
                      {f.student_name} <span className="text-muted-foreground text-xs">({f.admission_no})</span>
                    </TableCell>
                    <TableCell>{f.period_month}</TableCell>
                    <TableCell className="font-medium">{formatMinor(f.amount_due_minor)}</TableCell>
                    <TableCell>
                      <StatusBadge status={f.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
