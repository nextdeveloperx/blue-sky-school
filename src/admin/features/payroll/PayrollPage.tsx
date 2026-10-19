import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { rupeesToMinor, formatMinor } from "@/lib/finance/money";

type AdjustmentKind = "deduction" | "advance" | "bonus";
type PaymentMethod = "cash" | "upi" | "bank_transfer";

export default function PayrollPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  // staff + current salary assignment
  const [salaryStaffId, setSalaryStaffId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");

  // adjustment form
  const [adjStaffId, setAdjStaffId] = useState("");
  const [adjKind, setAdjKind] = useState<AdjustmentKind>("deduction");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [isAddingAdjustment, setIsAddingAdjustment] = useState(false);

  const { data: staffList } = useQuery({
    queryKey: ["staff_with_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, designation, profiles(email)");
      if (error) throw error;
      return data;
    },
  });

  const { data: salaries } = useQuery({
    queryKey: ["staff_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_salaries")
        .select("*, staff(designation, profiles(email))")
        .is("effective_to", null);
      if (error) throw error;
      return data;
    },
  });

  const { data: runs } = useQuery({
    queryKey: ["payroll_runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("period_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payslips } = useQuery({
    queryKey: ["payslips", selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, staff(designation, profiles(email))")
        .eq("payroll_run_id", selectedRunId);
      if (error) throw error;
      return data;
    },
  });

  const selectedRun = runs?.find((r) => r.id === selectedRunId);

  async function setSalary() {
    if (!salaryStaffId || !salaryAmount) {
      toast.error("Select staff and enter an amount");
      return;
    }
    // Close any existing active salary row, then open a new one — never an
    // in-place update, so a raise never loses payroll history.
    const { error: closeError } = await supabase
      .from("staff_salaries")
      .update({ effective_to: new Date().toISOString().slice(0, 10) })
      .eq("staff_id", salaryStaffId)
      .is("effective_to", null);
    if (closeError) {
      toast.error(closeError.message);
      return;
    }
    const { error } = await supabase.from("staff_salaries").insert({
      staff_id: salaryStaffId,
      monthly_amount_minor: rupeesToMinor(salaryAmount),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Salary set");
    setSalaryAmount("");
    queryClient.invalidateQueries({ queryKey: ["staff_salaries"] });
  }

  async function generateRun() {
    const { data, error } = await supabase.rpc("generate_payroll_run", {
      p_period_month: `${periodMonth}-01`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payroll run generated");
    setSelectedRunId(data as string);
    queryClient.invalidateQueries({ queryKey: ["payroll_runs"] });
  }

  async function addAdjustment() {
    if (isAddingAdjustment) return;
    if (!selectedRunId || !adjStaffId || !adjAmount || !adjReason) {
      toast.error("Select staff, amount, and a reason");
      return;
    }

    setIsAddingAdjustment(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { error } = await supabase.rpc("add_salary_adjustment", {
        p_payroll_run_id: selectedRunId,
        p_staff_id: adjStaffId,
        p_kind: adjKind,
        p_amount_minor: rupeesToMinor(adjAmount),
        p_reason: adjReason,
        p_idempotency_key: idempotencyKey,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Adjustment added");
      setAdjAmount("");
      setAdjReason("");
      queryClient.invalidateQueries({ queryKey: ["payslips", selectedRunId] });
    } finally {
      setIsAddingAdjustment(false);
    }
  }

  async function finalizeRun() {
    const { error } = await supabase.rpc("finalize_payroll_run", {
      p_payroll_run_id: selectedRunId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Payroll run finalized");
    queryClient.invalidateQueries({ queryKey: ["payroll_runs"] });
  }

  async function markPaid(payslipId: string, method: PaymentMethod) {
    const { error } = await supabase.rpc("mark_payslip_paid", {
      p_payslip_id: payslipId,
      p_payment_method: method,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked as paid");
    queryClient.invalidateQueries({ queryKey: ["payslips", selectedRunId] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Payroll</h1>
        <p className="text-muted-foreground">Fixed monthly salaries, adjustments, and payslips.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Staff Salaries</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff</TableHead>
              <TableHead>Monthly Amount</TableHead>
              <TableHead>Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salaries?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{(s.staff as unknown as { profiles: { email: string } })?.profiles?.email}</TableCell>
                <TableCell>{formatMinor(s.monthly_amount_minor)}</TableCell>
                <TableCell>{s.effective_from}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex gap-2 items-end flex-wrap">
          <Select value={salaryStaffId} onValueChange={setSalaryStaffId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Staff" />
            </SelectTrigger>
            <SelectContent>
              {staffList?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {(s.profiles as unknown as { email: string })?.email} ({s.designation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Monthly amount (₹)"
            className="w-48"
            value={salaryAmount}
            onChange={(e) => setSalaryAmount(e.target.value)}
          />
          <Button onClick={setSalary}>Set salary</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Payroll Runs</h2>
        <div className="flex gap-2 items-end flex-wrap">
          <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          <Button onClick={generateRun}>Generate run</Button>
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="View a run" />
            </SelectTrigger>
            <SelectContent>
              {runs?.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.period_month} ({r.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRun?.status === "draft" && (
            <Button variant="outline" onClick={finalizeRun}>
              Finalize run
            </Button>
          )}
        </div>

        {selectedRunId && (
          <>
            {selectedRun?.status === "draft" && (
              <div className="flex gap-2 items-end flex-wrap">
                <Select value={adjStaffId} onValueChange={setAdjStaffId}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Staff" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {(s.profiles as unknown as { email: string })?.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={adjKind} onValueChange={(v) => setAdjKind(v as AdjustmentKind)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Kind" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deduction">Deduction</SelectItem>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="bonus">Bonus</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Amount (₹)"
                  className="w-32"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                />
                <Input
                  placeholder="Reason"
                  className="w-48"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                />
                <Button variant="outline" onClick={addAdjustment} disabled={isAddingAdjustment}>
                  {isAddingAdjustment ? "Adding…" : "Add adjustment"}
                </Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Adjustments</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payslips?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {(p.staff as unknown as { profiles: { email: string } })?.profiles?.email}
                    </TableCell>
                    <TableCell>{formatMinor(p.base_amount_minor)}</TableCell>
                    <TableCell>{formatMinor(p.adjustments_total_minor)}</TableCell>
                    <TableCell>{formatMinor(p.net_amount_minor)}</TableCell>
                    <TableCell>{p.paid_at ? `Paid (${p.payment_method})` : "—"}</TableCell>
                    <TableCell>
                      {selectedRun?.status === "finalized" && !p.paid_at && (
                        <Button variant="outline" size="sm" onClick={() => markPaid(p.id, "cash")}>
                          Mark paid (cash)
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </section>
    </div>
  );
}
