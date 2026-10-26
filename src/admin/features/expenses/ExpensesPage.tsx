import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Pencil, Ban, Download } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";
import { InfoHelp } from "@/components/InfoHelp";
import { ChartTypeSwitcher } from "@/components/charts/ChartTypeSwitcher";
import { useSession } from "@/lib/auth/useSession";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatMinor } from "@/lib/finance/money";
import { toCsv, downloadCsv } from "@/lib/export/csv";
import {
  canManageExpenses,
  computeExpenseTotals,
  filterExpenses,
  groupExpensesByCategory,
  groupExpensesByDate,
  groupExpensesByPeriod,
  matchesPeriodLabel,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type ExpenseFilterRow,
  type TrendGranularity,
} from "@/lib/expenses/expenseHelpers";
import ExpenseFormDialog, { type EditableExpense } from "./ExpenseFormDialog";

interface ExpenseRow extends ExpenseFilterRow {
  amount_minor: number;
  payment_method: string;
  receipt_ref: string | null;
  category_name: string | null;
  recorded_by_name: string | null;
  updated_by_name: string | null;
  updated_at: string | null;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-elevated p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-heading font-bold text-2xl text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function VoidExpenseAction({ expenseId, title }: { expenseId: string; title: string }) {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  async function voidExpense() {
    if (!reason.trim()) {
      toast.error("A reason is required to void an expense");
      return;
    }
    const { data: staffId, error: staffError } = await supabase.rpc("current_staff_id");
    if (staffError || !staffId) {
      toast.error("Could not identify your staff record — contact the principal.");
      return;
    }
    const { error } = await supabase
      .from("expenses")
      .update({
        voided_at: new Date().toISOString(),
        voided_by: staffId as string,
        void_reason: reason.trim(),
      })
      .eq("id", expenseId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense voided");
    setOpen(false);
    setReason("");
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Void ${title}`}>
          <Ban className="w-4 h-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void "{title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This is a financial record, so it's never hard-deleted — voiding removes it from totals
            and reports but keeps it (and this reason) visible in the audit trail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Reason (required)</label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={voidExpense}>Void expense</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function ExpensesPage() {
  const supabase = getSupabaseClient();
  const { roles } = useSession();
  const canManage = canManageExpenses(roles);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("month");
  const [categoryDrill, setCategoryDrill] = useState<string | null>(null);
  const [periodDrill, setPeriodDrill] = useState<string | null>(null);

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const {
    data: expenses,
    isLoading: expensesLoading,
    isError: expensesError,
    error: expensesErrorObj,
  } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select(
          "id, title, category_id, incurred_on, amount_minor, payment_method, vendor, description, receipt_ref, voided_at, updated_at, expense_categories(name), recorded_by_staff:staff!expenses_recorded_by_fkey(profiles(full_name)), updated_by_staff:staff!expenses_updated_by_fkey(profiles(full_name))",
        )
        .order("incurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((e): ExpenseRow => ({
        id: e.id,
        title: e.title,
        category_id: e.category_id,
        category_name: (e.expense_categories as unknown as { name: string } | null)?.name ?? null,
        incurred_on: e.incurred_on,
        amount_minor: e.amount_minor,
        payment_method: e.payment_method,
        vendor: e.vendor,
        description: e.description,
        receipt_ref: e.receipt_ref,
        voided_at: e.voided_at,
        updated_at: e.updated_at,
        recorded_by_name:
          (e.recorded_by_staff as unknown as { profiles: { full_name: string } | null } | null)?.profiles
            ?.full_name || null,
        updated_by_name:
          (e.updated_by_staff as unknown as { profiles: { full_name: string } | null } | null)?.profiles
            ?.full_name || null,
      }));
    },
  });

  const filtered = useMemo(() => {
    if (!expenses) return [];
    return filterExpenses(expenses, {
      search,
      categoryId: categoryFilter === "all" ? undefined : categoryFilter,
      paymentMethod: methodFilter === "all" ? undefined : methodFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      includeVoided,
    });
  }, [expenses, search, categoryFilter, methodFilter, dateFrom, dateTo, includeVoided]);

  // Local calendar date, not toISOString()'s UTC date — a viewer west of
  // UTC near midnight would otherwise see "today" labeled as yesterday (or
  // vice versa east of UTC). en-CA formats as YYYY-MM-DD, matching
  // `incurred_on`'s own format exactly.
  const today = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const monthPrefix = today.slice(0, 7);

  const dateGroups = useMemo(() => groupExpensesByDate(filtered, today), [filtered, today]);

  const totals = useMemo(
    () =>
      computeExpenseTotals(expenses ?? [], {
        today,
        monthPrefix,
        rangeFrom: dateFrom || undefined,
        rangeTo: dateTo || undefined,
      }),
    [expenses, today, monthPrefix, dateFrom, dateTo],
  );

  const hasRange = Boolean(dateFrom || dateTo);

  // Charts are built from the SAME `filtered` array that drives the table
  // and the CSV export, so a chart can never show a number that disagrees
  // with what's visible in the table below it — one source of truth for
  // "what the current filters select". The grouping functions themselves
  // additionally exclude voided rows unconditionally, regardless of the
  // "Show voided" toggle, since a voided expense must never count toward a
  // spend total even if it's visible in the table for audit purposes.
  const categoryChartData = useMemo(() => groupExpensesByCategory(filtered), [filtered]);
  const trendChartData = useMemo(
    () => groupExpensesByPeriod(filtered, trendGranularity),
    [filtered, trendGranularity],
  );

  const categoryDrillRows = categoryDrill
    ? filtered.filter((e) => !e.voided_at && (e.category_name ?? "Uncategorized") === categoryDrill)
    : [];
  const periodDrillRows = periodDrill
    ? filtered.filter((e) => !e.voided_at && matchesPeriodLabel(e.incurred_on, periodDrill, trendGranularity))
    : [];

  function exportFiltered() {
    const rows = filtered.map((e) => ({
      date: e.incurred_on,
      title: e.title,
      category: e.category_name ?? "",
      vendor: e.vendor ?? "",
      payment_method: PAYMENT_METHOD_LABELS[e.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? e.payment_method,
      amount: formatMinor(e.amount_minor),
      recorded_by: e.recorded_by_name ?? "",
      status: e.voided_at ? "Voided" : "Active",
      description: e.description ?? "",
    }));
    downloadCsv(`expenses-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
    toast.success(`Exported ${rows.length} row(s) matching the current filters`);
  }

  if (!canManage) {
    return (
      <div className="card-elevated p-8 text-center">
        <p className="text-foreground font-medium">You don't have access to Expenses.</p>
        <p className="text-muted-foreground text-sm mt-1">
          Only the principal or accountant can view and manage school expenses.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="font-heading font-bold text-2xl text-foreground">Daily Expenses</h1>
            <p className="text-muted-foreground">Record school expenses and review spending by date and category.</p>
          </div>
          <InfoHelp
            title="Daily Expenses"
            content={{
              purpose:
                "Keep a running record of everything the school spends money on — utilities, repairs, supplies, and so on — and see totals by day, month, or any date range you choose.",
              steps: [
                "Select \"Add expense\" and fill in what it was for, the category, date, amount, and how it was paid.",
                "Use the filters to narrow the list by date range, category, or payment method, or search by title/vendor — the charts above update to match the same filters.",
                "Switch a chart between bar, line, pie, or doughnut using the icons above it, and select any bar, slice, or point to see exactly which expenses make up that number.",
                "Select \"Export CSV\" to download exactly the rows currently shown on screen.",
              ],
              rules: [
                "Expenses are never permanently deleted — \"Void\" removes one from totals, reports, and charts but keeps a full record of what it was and why it was voided.",
                "Only the principal or accountant can add, edit, or void expenses.",
                "Every change is recorded with who made it and when, for the school's own records.",
              ],
              nextSteps:
                "Totals at the top update immediately and reflect only active (non-voided) expenses.",
            }}
          />
        </div>
        {categories && <ExpenseFormDialog categories={categories} mode="add" />}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's total" value={formatMinor(totals.todayTotalMinor)} />
        <StatCard label="Expenses recorded today" value={String(totals.todayCount)} />
        <StatCard label="This month's total" value={formatMinor(totals.monthTotalMinor)} />
        <StatCard
          label={hasRange ? "Selected range total" : "All-time total (loaded)"}
          value={formatMinor(totals.rangeTotalMinor)}
          hint={hasRange ? `${totals.rangeCount} expense(s)` : undefined}
        />
      </div>

      <ChartTypeSwitcher
        title="Spending by category"
        description="Where this school's money is going, for the current filters. Click a value to see those expenses."
        data={categoryChartData}
        valueLabel="Spent"
        valueFormatter={formatMinor}
        onElementClick={setCategoryDrill}
        availableTypes={["bar", "pie", "doughnut"]}
        defaultType="bar"
        emptyMessage="No expenses match the current filters."
        isLoading={expensesLoading || categoriesLoading}
        isError={expensesError}
        errorMessage="Could not load expenses for this chart."
      />

      <ChartTypeSwitcher
        title="Expense trend"
        description={`Total spend per ${trendGranularity}, for the current filters. Click a value to see those expenses.`}
        data={trendChartData}
        valueLabel="Spent"
        valueFormatter={formatMinor}
        onElementClick={setPeriodDrill}
        availableTypes={["bar", "line"]}
        defaultType="bar"
        emptyMessage="No expenses match the current filters."
        isLoading={expensesLoading}
        isError={expensesError}
        errorMessage="Could not load expenses for this chart."
        extraControls={
          <ToggleGroup
            type="single"
            value={trendGranularity}
            onValueChange={(v) => v && setTrendGranularity(v as TrendGranularity)}
            aria-label="Trend granularity"
          >
            <ToggleGroupItem value="day" aria-label="Daily" size="sm">
              Daily
            </ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Monthly" size="sm">
              Monthly
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      <section className="card-elevated p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search title, vendor, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">From</label>
            <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">To</label>
            <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-voided"
              checked={includeVoided}
              onCheckedChange={(v) => setIncludeVoided(v === true)}
            />
            <label htmlFor="include-voided" className="text-sm text-muted-foreground">
              Show voided
            </label>
          </div>
          <Button variant="outline" onClick={exportFiltered} disabled={filtered.length === 0}>
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {expensesLoading || categoriesLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading expenses…</p>
        ) : expensesError ? (
          <p className="text-destructive text-sm py-8 text-center">
            Could not load expenses: {expensesErrorObj instanceof Error ? expensesErrorObj.message : "unknown error"}
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {expenses && expenses.length > 0
              ? "No expenses match the current filters."
              : "No expenses recorded yet — use \"Add expense\" to record the first one."}
          </p>
        ) : (
          <div className="space-y-3">
            {dateGroups.map((group, i) => (
              <details
                key={group.dateKey}
                open={i === 0}
                className="rounded-lg border border-border overflow-hidden group"
              >
                <summary className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/60 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                  <span className="font-heading font-semibold text-sm text-foreground">
                    {group.label}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({new Date(`${group.dateKey}T00:00:00`).toLocaleDateString()})
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {group.count} expense{group.count === 1 ? "" : "s"} · {formatMinor(group.totalMinor)}
                  </span>
                </summary>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/60 hover:bg-muted/60">
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Recorded by</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.expenses.map((e) => {
                        const categoryName = e.category_name;
                        const editable: EditableExpense = {
                          id: e.id,
                          title: e.title,
                          category_id: e.category_id,
                          incurred_on: e.incurred_on,
                          amount_minor: e.amount_minor,
                          payment_method: e.payment_method,
                          vendor: e.vendor,
                          description: e.description,
                          receipt_ref: e.receipt_ref,
                        };
                        return (
                          <TableRow key={e.id} className={e.voided_at ? "opacity-60" : undefined}>
                            <TableCell className="font-medium">{e.title}</TableCell>
                            <TableCell>{categoryName ?? "—"}</TableCell>
                            <TableCell>{e.vendor ?? "—"}</TableCell>
                            <TableCell className="capitalize">
                              {PAYMENT_METHOD_LABELS[e.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ??
                                e.payment_method}
                            </TableCell>
                            <TableCell className="font-medium whitespace-nowrap">{formatMinor(e.amount_minor)}</TableCell>
                            <TableCell>{e.recorded_by_name ?? "—"}</TableCell>
                            <TableCell>
                              <StatusBadge status={e.voided_at ? "voided" : "active"} />
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                {!e.voided_at && (
                                  <>
                                    <ExpenseFormDialog
                                      categories={categories ?? []}
                                      mode="edit"
                                      expense={editable}
                                      trigger={
                                        <Button variant="ghost" size="icon" aria-label={`Edit ${e.title}`}>
                                          <Pencil className="w-4 h-4" />
                                        </Button>
                                      }
                                    />
                                    <VoidExpenseAction expenseId={e.id} title={e.title} />
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
              </details>
            ))}
          </div>
        )}
      </section>

      <Dialog open={!!categoryDrill} onOpenChange={(open) => !open && setCategoryDrill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{categoryDrill} expenses</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryDrillRows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.incurred_on}</TableCell>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell>{e.vendor ?? "—"}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{formatMinor(e.amount_minor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!periodDrill} onOpenChange={(open) => !open && setPeriodDrill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expenses — {periodDrill}</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>Date</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodDrillRows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">{e.incurred_on}</TableCell>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell>{e.category_name ?? "—"}</TableCell>
                    <TableCell className="font-medium whitespace-nowrap">{formatMinor(e.amount_minor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
