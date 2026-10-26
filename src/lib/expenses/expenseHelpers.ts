import { z } from "zod";
import type { AppRole } from "@/lib/auth/useSession";

export const PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "cheque", "other"] as const;
export type ExpensePaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<ExpensePaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  other: "Other",
};

/** Default category set a new school starts with — seeded by the migration, editable afterward. */
export const DEFAULT_EXPENSE_CATEGORIES = [
  "Electricity",
  "Water",
  "School Supplies",
  "Cleaning",
  "Repairs & Maintenance",
  "Transportation",
  "Staff Welfare",
  "Events",
  "Internet/Telephone",
  "Other",
] as const;

export const expenseFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  category_id: z.string().uuid("Select a category"),
  incurred_on: z.string().min(1, "Date is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number.isFinite(Number(v)), "Enter a valid amount")
    .refine((v) => Number(v) > 0, "Amount must be greater than zero"),
  payment_method: z.enum(PAYMENT_METHODS, { errorMap: () => ({ message: "Select a payment method" }) }),
  vendor: z.string().trim().max(200, "Too long").optional().or(z.literal("")),
  description: z.string().trim().max(2000, "Too long").optional().or(z.literal("")),
  receipt_ref: z.string().trim().max(200, "Too long").optional().or(z.literal("")),
});

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

/** Mirrors the RLS role check on the expenses table (migration 24, tightened in 32) — a UX
 * convenience for gating the Add/Edit UI only; the server is still the real enforcement point. */
export function canManageExpenses(roles: AppRole[]): boolean {
  return roles.includes("principal") || roles.includes("accountant");
}

export interface ExpenseLike {
  amount_minor: number;
  incurred_on: string; // YYYY-MM-DD
  voided_at: string | null;
}

export interface ExpenseTotals {
  todayTotalMinor: number;
  todayCount: number;
  monthTotalMinor: number;
  rangeTotalMinor: number;
  rangeCount: number;
}

/**
 * Computes the four dashboard summary figures from an already-fetched list of (non-voided or
 * voided-tagged) expenses. `today`/`monthPrefix` are injected rather than read from `Date.now()`
 * internally so this stays a pure, deterministic function for testing.
 */
export function computeExpenseTotals(
  expenses: ExpenseLike[],
  opts: { today: string; monthPrefix: string; rangeFrom?: string; rangeTo?: string },
): ExpenseTotals {
  const active = expenses.filter((e) => !e.voided_at);

  const todayRows = active.filter((e) => e.incurred_on === opts.today);
  const monthRows = active.filter((e) => e.incurred_on.startsWith(opts.monthPrefix));
  const rangeRows = active.filter((e) => {
    if (opts.rangeFrom && e.incurred_on < opts.rangeFrom) return false;
    if (opts.rangeTo && e.incurred_on > opts.rangeTo) return false;
    return true;
  });

  return {
    todayTotalMinor: todayRows.reduce((sum, e) => sum + e.amount_minor, 0),
    todayCount: todayRows.length,
    monthTotalMinor: monthRows.reduce((sum, e) => sum + e.amount_minor, 0),
    rangeTotalMinor: rangeRows.reduce((sum, e) => sum + e.amount_minor, 0),
    rangeCount: rangeRows.length,
  };
}

export interface ExpenseFilterRow {
  id: string;
  title: string;
  vendor: string | null;
  description: string | null;
  category_id: string;
  payment_method: string;
  incurred_on: string;
  voided_at: string | null;
}

export interface ExpenseFilters {
  search?: string;
  categoryId?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  includeVoided?: boolean;
}

/** Client-side filtering over an already-fetched page of expenses — used both by the table and
 * by the "export filtered rows" button so the two can never disagree. */
export function filterExpenses<T extends ExpenseFilterRow>(expenses: T[], filters: ExpenseFilters): T[] {
  const search = filters.search?.trim().toLowerCase();
  return expenses.filter((e) => {
    if (!filters.includeVoided && e.voided_at) return false;
    if (filters.categoryId && e.category_id !== filters.categoryId) return false;
    if (filters.paymentMethod && e.payment_method !== filters.paymentMethod) return false;
    if (filters.dateFrom && e.incurred_on < filters.dateFrom) return false;
    if (filters.dateTo && e.incurred_on > filters.dateTo) return false;
    if (search) {
      const haystack = `${e.title} ${e.vendor ?? ""} ${e.description ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Deliberately string-only date math — `incurred_on` is a plain YYYY-MM-DD
// date with no time component. Parsing it with `new Date(isoString)` reads
// it as UTC midnight, and formatting that with locale methods can then
// shift the displayed day by one depending on the viewer's timezone. Every
// label below is built by splitting the string, never by constructing a
// Date object, so there is no timezone-dependent date-boundary bug.
function formatDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
}

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export interface CategoryChartRow {
  category_name: string | null;
  amount_minor: number;
  voided_at: string | null;
}

/**
 * Total spend per category, largest first — the useful default ordering for
 * "where is the money going". Always excludes voided expenses regardless of
 * whether the caller's list includes them (a voided expense must never
 * count toward a spend total, independent of any "show voided" UI toggle).
 */
export function groupExpensesByCategory(expenses: CategoryChartRow[]): { name: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (e.voided_at) continue;
    const name = e.category_name ?? "Uncategorized";
    totals.set(name, (totals.get(name) ?? 0) + e.amount_minor);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
}

export type TrendGranularity = "day" | "month";

/**
 * Total spend per day or per month, in chronological order (a trend chart
 * reads left-to-right as time, unlike the category chart's magnitude
 * ordering). The label always includes the year, so two different years'
 * "Jul" or "5 Jul" can never collide as the same chart category — both the
 * displayed label and the value used for click-to-drill-down are this same
 * string, so an ambiguous label would silently merge two different
 * periods' expenses in the detail view.
 */
export function groupExpensesByPeriod(
  expenses: ExpenseLike[],
  granularity: TrendGranularity,
): { name: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (e.voided_at) continue;
    const key = granularity === "day" ? e.incurred_on : e.incurred_on.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + e.amount_minor);
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      name: granularity === "day" ? formatDayLabel(key) : formatMonthLabel(key),
      value,
    }));
}

/** True if `incurred_on` falls within the same period as the given chart label (matches the
 * exact label text produced by groupExpensesByPeriod, for click-to-drill-down filtering). */
export function matchesPeriodLabel(incurredOn: string, label: string, granularity: TrendGranularity): boolean {
  const ownLabel = granularity === "day" ? formatDayLabel(incurredOn) : formatMonthLabel(incurredOn.slice(0, 7));
  return ownLabel === label;
}
