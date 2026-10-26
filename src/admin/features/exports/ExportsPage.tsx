import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatMinor } from "@/lib/finance/money";
import { toCsv, downloadCsv } from "@/lib/export/csv";

type ExportType = "students" | "payments" | "results" | "payroll" | "expenses";

export default function ExportsPage() {
  const supabase = getSupabaseClient();
  const [type, setType] = useState<ExportType>("students");
  const [isExporting, setIsExporting] = useState(false);

  async function runExport() {
    setIsExporting(true);
    try {
      const requestId = (
        await supabase.rpc("request_export", { p_export_type: type, p_filters: {} })
      ).data as string;

      let rows: Record<string, unknown>[] = [];

      if (type === "students") {
        const { data, error } = await supabase
          .from("students")
          .select("admission_no, full_name, dob, gender, status, sections(name, classes(name))");
        if (error) throw error;
        rows = (data ?? []).map((s) => {
          const section = s.sections as unknown as { name: string; classes: { name: string } } | null;
          return {
            admission_no: s.admission_no,
            full_name: s.full_name,
            dob: s.dob,
            gender: s.gender,
            status: s.status,
            class: section?.classes?.name,
            section: section?.name,
          };
        });
      } else if (type === "payments") {
        const { data, error } = await supabase
          .from("payments")
          .select("receipt_number, amount_minor, method, received_at, is_refund, students(admission_no, full_name)");
        if (error) throw error;
        rows = (data ?? []).map((p) => {
          const student = p.students as unknown as { admission_no: string; full_name: string } | null;
          return {
            receipt_number: p.receipt_number,
            student: student?.full_name,
            admission_no: student?.admission_no,
            amount: formatMinor(p.amount_minor),
            method: p.method,
            is_refund: p.is_refund,
            received_at: p.received_at,
          };
        });
      } else if (type === "results") {
        // Published-only, enforced by RLS for non-principal/accountant roles;
        // here we additionally filter client-side so the export never leaks
        // a draft grade even though principal/accountant CAN read drafts.
        const { data, error } = await supabase
          .from("results")
          .select("percentage, overall_grade, status, students(admission_no, full_name), exam_terms(name)")
          .eq("status", "published");
        if (error) throw error;
        rows = (data ?? []).map((r) => {
          const student = r.students as unknown as { admission_no: string; full_name: string } | null;
          const term = r.exam_terms as unknown as { name: string } | null;
          return {
            student: student?.full_name,
            admission_no: student?.admission_no,
            term: term?.name,
            percentage: r.percentage,
            grade: r.overall_grade,
          };
        });
      } else if (type === "payroll") {
        const { data, error } = await supabase
          .from("payslips")
          .select("base_amount_minor, adjustments_total_minor, net_amount_minor, paid_at, staff(designation, profiles(email))");
        if (error) throw error;
        rows = (data ?? []).map((p) => {
          const staffMember = p.staff as unknown as {
            designation: string | null;
            profiles: { email: string } | null;
          } | null;
          return {
            staff: staffMember?.profiles?.email,
            designation: staffMember?.designation,
            base: formatMinor(p.base_amount_minor),
            adjustments: formatMinor(p.adjustments_total_minor),
            net: formatMinor(p.net_amount_minor),
            paid_at: p.paid_at,
          };
        });
      } else if (type === "expenses") {
        // Voided expenses are excluded here (same as the Daily Expenses page's
        // default view) so this export's totals always match an unfiltered,
        // "active expenses only" report.
        const { data, error } = await supabase
          .from("expenses")
          .select("incurred_on, title, amount_minor, payment_method, vendor, description, expense_categories(name)")
          .is("voided_at", null);
        if (error) throw error;
        rows = (data ?? []).map((e) => ({
          date: e.incurred_on,
          title: e.title,
          category: (e.expense_categories as unknown as { name: string })?.name,
          vendor: e.vendor,
          payment_method: e.payment_method,
          amount: formatMinor(e.amount_minor),
          description: e.description,
        }));
      }

      downloadCsv(`${type}-export-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));

      if (requestId) {
        await supabase.rpc("complete_export", {
          p_export_request_id: requestId,
          p_row_count: rows.length,
        });
      }

      toast.success(`Exported ${rows.length} row(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Exports</h1>
        <p className="text-muted-foreground">
          Every export is logged (who, what, when, how many rows) before the file downloads.
        </p>
      </div>

      <div className="flex gap-2 items-end">
        <Select value={type} onValueChange={(v) => setType(v as ExportType)}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Export type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="students">Students roster</SelectItem>
            <SelectItem value="payments">Payments ledger</SelectItem>
            <SelectItem value="results">Results (published only)</SelectItem>
            <SelectItem value="payroll">Payroll summary</SelectItem>
            <SelectItem value="expenses">Expenses</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={runExport} disabled={isExporting}>
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>
    </div>
  );
}
