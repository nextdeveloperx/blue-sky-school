import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
import { formatMinor } from "@/lib/finance/money";
import type { StudentSearchResult } from "./StudentSearchCombobox";

const PAGE_SIZE = 15;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

type StudentOverviewRow = StudentSearchResult & {
  status: string;
  totalFeesMinor: number;
  amountPaidMinor: number;
  outstandingMinor: number;
};

/**
 * A searchable, paginated overview of every student, with each one's fee
 * totals — separate from (and feeding into) the existing search-and-record
 * payment form above it. Selecting a row here calls the exact same
 * `onSelect` the search combobox uses, so both entry points open the same
 * payment form.
 */
export function StudentOverviewTable({ onSelect }: { onSelect: (student: StudentSearchResult) => void }) {
  const supabase = getSupabaseClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const {
    data: pageResult,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["student_overview", search, page],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("students")
        .select("id, admission_no, full_name, status, sections(name, classes(name))", { count: "exact" })
        .order("full_name")
        .range(from, to);
      const q = search.trim().replace(/[%_]/g, "\\$&");
      if (q) {
        query = query.or(`full_name.ilike.%${q}%,admission_no.ilike.%${q}%`);
      }
      const { data, error, count } = await query;
      if (error) throw error;

      const students = data ?? [];
      const studentIds = students.map((s) => s.id);

      const feeTotals = new Map<string, number>();
      const paidTotals = new Map<string, number>();
      if (studentIds.length > 0) {
        const { data: schedules, error: scheduleError } = await supabase
          .from("fee_schedules")
          .select("id, student_id, amount_due_minor")
          .in("student_id", studentIds);
        if (scheduleError) throw scheduleError;

        for (const s of schedules ?? []) {
          feeTotals.set(s.student_id, (feeTotals.get(s.student_id) ?? 0) + s.amount_due_minor);
        }

        const scheduleIds = (schedules ?? []).map((s) => s.id);
        if (scheduleIds.length > 0) {
          const { data: allocations, error: allocationError } = await supabase
            .from("payment_allocations")
            .select("allocated_amount_minor, fee_schedules!inner(student_id)")
            .in("fee_schedule_id", scheduleIds);
          if (allocationError) throw allocationError;

          for (const a of allocations ?? []) {
            const studentId = (a.fee_schedules as unknown as { student_id: string }).student_id;
            paidTotals.set(studentId, (paidTotals.get(studentId) ?? 0) + a.allocated_amount_minor);
          }
        }
      }

      const rows: StudentOverviewRow[] = students.map((s) => {
        const section = s.sections as unknown as { name: string; classes: { name: string } | null } | null;
        const totalFeesMinor = feeTotals.get(s.id) ?? 0;
        const amountPaidMinor = paidTotals.get(s.id) ?? 0;
        return {
          id: s.id,
          admission_no: s.admission_no,
          full_name: s.full_name,
          status: s.status,
          class_name: section?.classes?.name ?? null,
          section_name: section?.name ?? null,
          totalFeesMinor,
          amountPaidMinor,
          outstandingMinor: Math.max(totalFeesMinor - amountPaidMinor, 0),
        };
      });

      return { rows, total: count ?? 0 };
    },
  });

  const rows = pageResult?.rows ?? [];
  const total = pageResult?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <section className="card-elevated p-4 space-y-3">
      <div>
        <h2 className="font-heading font-semibold text-lg">All students</h2>
        <p className="text-sm text-muted-foreground">
          Browse every student with their fee summary. Select a row to record a payment for them.
        </p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or admission no..."
          className="pl-8"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead />
              <TableHead>Student</TableHead>
              <TableHead>Class / Section</TableHead>
              <TableHead>Total fees</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Outstanding</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive py-8" role="alert">
                  Could not load students — try refreshing the page.
                </TableCell>
              </TableRow>
            ) : isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {search ? `No students match "${search}".` : "No students found."}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((s) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => onSelect(s)}
                >
                  <TableCell>
                    <div
                      className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold"
                      aria-hidden="true"
                    >
                      {initials(s.full_name)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{s.admission_no}</div>
                  </TableCell>
                  <TableCell>
                    {s.class_name ? `${s.class_name}${s.section_name ? `-${s.section_name}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>{formatMinor(s.totalFeesMinor)}</TableCell>
                  <TableCell>{formatMinor(s.amountPaidMinor)}</TableCell>
                  <TableCell className={s.outstandingMinor > 0 ? "font-medium text-destructive" : undefined}>
                    {formatMinor(s.outstandingMinor)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} students)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
