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
import { InfoHelp } from "@/components/InfoHelp";
import { StatusBadge } from "@/components/StatusBadge";
import { RowActionsMenu } from "@/components/RowActionsMenu";
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
import {
  ADJUSTMENT_KIND_EXPLANATIONS,
  ADJUSTMENT_KIND_LABELS,
  ADJUSTMENT_KINDS,
  PAYROLL_PAYMENT_METHOD_LABELS,
  PAYROLL_PAYMENT_METHODS,
  computePayrollSummary,
  type AdjustmentKind,
  type PayrollPaymentMethod,
} from "@/lib/payroll/payrollHelpers";

type StaffWithProfile = { id: string; designation: string; profiles: { email: string } | null };
type SalaryRow = {
  id: string;
  staff_id: string;
  monthly_amount_minor: number;
  effective_from: string;
  effective_to: string | null;
  staff: { designation: string; profiles: { email: string } | null } | null;
};
type PayslipRow = {
  id: string;
  staff_id: string;
  base_amount_minor: number;
  adjustments_total_minor: number;
  net_amount_minor: number;
  paid_at: string | null;
  payment_method: PayrollPaymentMethod | null;
  staff: { designation: string; profiles: { email: string } | null } | null;
};
type AdjustmentRow = {
  id: string;
  staff_id: string;
  kind: AdjustmentKind;
  amount_minor: number;
  reason: string;
  created_at: string;
  staff: { designation: string; profiles: { email: string } | null } | null;
};

function staffLabel(staff: { designation: string; profiles: { email: string } | null } | null): string {
  if (!staff) return "Unknown staff member";
  return staff.profiles?.email ? `${staff.profiles.email} (${staff.designation})` : staff.designation;
}

export default function PayrollPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  // Staff Salaries section: add-new-salary form + inline per-row edit
  const [salaryStaffId, setSalaryStaffId] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [isSavingSalary, setIsSavingSalary] = useState(false);
  const [editingSalaryId, setEditingSalaryId] = useState<string | null>(null);
  const [editingSalaryAmount, setEditingSalaryAmount] = useState("");
  const [removeFromPayrollTarget, setRemoveFromPayrollTarget] = useState<{ staffId: string; label: string } | null>(null);

  // Salary Adjustments section: add-adjustment form
  const [adjStaffId, setAdjStaffId] = useState("");
  const [adjKind, setAdjKind] = useState<AdjustmentKind>("bonus");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [isAddingAdjustment, setIsAddingAdjustment] = useState(false);

  // Monthly Payroll section: per-payslip payment method selection
  const [paymentMethods, setPaymentMethods] = useState<Record<string, PayrollPaymentMethod>>({});

  const { data: staffList } = useQuery({
    queryKey: ["staff_with_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("id, designation, profiles(email)");
      if (error) throw error;
      return data as unknown as StaffWithProfile[];
    },
  });

  const {
    data: salaries,
    isLoading: salariesLoading,
    isError: salariesError,
  } = useQuery({
    queryKey: ["staff_salaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_salaries")
        .select("*, staff(designation, profiles(email))")
        .is("effective_to", null)
        .order("effective_from", { ascending: false });
      if (error) throw error;
      return data as unknown as SalaryRow[];
    },
  });

  const {
    data: runs,
    isLoading: runsLoading,
    isError: runsError,
  } = useQuery({
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

  const {
    data: payslips,
    isLoading: payslipsLoading,
    isError: payslipsError,
  } = useQuery({
    queryKey: ["payslips", selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payslips")
        .select("*, staff(designation, profiles(email))")
        .eq("payroll_run_id", selectedRunId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as PayslipRow[];
    },
  });

  const {
    data: adjustments,
    isLoading: adjustmentsLoading,
    isError: adjustmentsError,
  } = useQuery({
    queryKey: ["salary_adjustments", selectedRunId],
    enabled: !!selectedRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("salary_adjustments")
        .select("*, staff(designation, profiles(email))")
        .eq("payroll_run_id", selectedRunId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AdjustmentRow[];
    },
  });

  const selectedRun = runs?.find((r) => r.id === selectedRunId);
  const summary = computePayrollSummary(payslips ?? []);

  async function addSalary() {
    if (!salaryStaffId || !salaryAmount) {
      toast.error("Select a staff member and enter a monthly amount");
      return;
    }
    setIsSavingSalary(true);
    try {
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
      setSalaryStaffId("");
      setSalaryAmount("");
      queryClient.invalidateQueries({ queryKey: ["staff_salaries"] });
    } finally {
      setIsSavingSalary(false);
    }
  }

  async function saveEditedSalary(staffId: string) {
    if (!editingSalaryAmount) {
      toast.error("Enter a monthly amount");
      return;
    }
    setIsSavingSalary(true);
    try {
      const { error: closeError } = await supabase
        .from("staff_salaries")
        .update({ effective_to: new Date().toISOString().slice(0, 10) })
        .eq("staff_id", staffId)
        .is("effective_to", null);
      if (closeError) {
        toast.error(closeError.message);
        return;
      }
      const { error } = await supabase.from("staff_salaries").insert({
        staff_id: staffId,
        monthly_amount_minor: rupeesToMinor(editingSalaryAmount),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Salary updated");
      setEditingSalaryId(null);
      setEditingSalaryAmount("");
      queryClient.invalidateQueries({ queryKey: ["staff_salaries"] });
    } finally {
      setIsSavingSalary(false);
    }
  }

  // Removes a teacher/staff member from FUTURE payroll only: closes their
  // current staff_salaries row with no replacement. generate_payroll_run
  // only ever includes staff with an active (effective_to IS NULL) salary
  // row, so this is sufficient and already fully RLS-covered — no new
  // migration needed. Every past payslip and salary_adjustment keeps
  // referencing this staff_id untouched; nothing here can delete history.
  async function removeFromPayroll() {
    if (!removeFromPayrollTarget) return;
    const { error } = await supabase
      .from("staff_salaries")
      .update({ effective_to: new Date().toISOString().slice(0, 10) })
      .eq("staff_id", removeFromPayrollTarget.staffId)
      .is("effective_to", null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${removeFromPayrollTarget.label} removed from future payroll runs`);
    setRemoveFromPayrollTarget(null);
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
    toast.success("Draft payroll generated for " + periodMonth);
    setSelectedRunId(data as string);
    queryClient.invalidateQueries({ queryKey: ["payroll_runs"] });
  }

  async function addAdjustment() {
    if (isAddingAdjustment) return;
    if (!selectedRunId || !adjStaffId || !adjAmount || !adjReason) {
      toast.error("Select a staff member, amount, and a reason");
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
      toast.success(`${ADJUSTMENT_KIND_LABELS[adjKind]} added`);
      setAdjAmount("");
      setAdjReason("");
      queryClient.invalidateQueries({ queryKey: ["payslips", selectedRunId] });
      queryClient.invalidateQueries({ queryKey: ["salary_adjustments", selectedRunId] });
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
    toast.success("Payroll run finalized — amounts are now locked");
    queryClient.invalidateQueries({ queryKey: ["payroll_runs"] });
  }

  async function markPaid(payslipId: string) {
    const method = paymentMethods[payslipId] ?? "cash";
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
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Payroll</h1>
          <p className="text-muted-foreground">
            Set staff salaries, prepare each month's payroll, and record who has actually been paid.
          </p>
        </div>
        <InfoHelp
          title="Payroll"
          content={{
            purpose:
              "Pay staff a fixed monthly salary, add one-off bonuses, advances, or deductions, and keep an accurate record of what was actually paid out and how.",
            steps: [
              "Staff Salaries: set each staff member's current monthly salary. A change here never edits the past — it only applies to future payroll runs.",
              "Monthly Payroll: pick a month and generate a draft. This creates one payslip per staff member who has a salary set.",
              "Salary Adjustments: while the run is still a draft, add any bonuses, advances, or deductions for that month, with a reason.",
              "Finalize the run once the amounts are correct. This locks the run — no further adjustments can be added to it.",
              "After finalizing, mark each payslip paid, choosing how it was paid (cash, UPI, or bank transfer).",
            ],
            rules: [
              "A finalized run cannot be edited. A correction after finalizing must go into a new, later run.",
              "\"Finalized\" only means the amounts are locked — it does not mean anyone has been paid. \"Paid\" is a separate, explicit step per staff member.",
              "Generating a run twice for the same month is blocked automatically — it will not create a duplicate.",
              "A payslip can only be marked paid once its run is finalized.",
            ],
            nextSteps:
              "Finalized payslips are ready to mark as paid. The Payroll Summary and Payroll History sections below always reflect only what the real records show.",
          }}
        />
      </div>

      {/* 1. Staff Salaries */}
      <section className="card-elevated p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading font-semibold text-lg">Staff Salaries</h2>
          <InfoHelp
            title="Staff Salaries"
            content={{
              purpose: "Shows each staff member's current monthly salary and the date it took effect.",
              steps: [
                "To change someone's salary, use Edit on their row, or add a new salary below for someone who doesn't have one yet.",
                "Saving a new amount closes the old salary record and starts a new one — it never overwrites history.",
              ],
              rules: ["Only the current (active) salary is shown here — past amounts remain on record but are not listed on this page."],
            }}
          />
        </div>
        {salariesError ? (
          <p className="text-sm text-destructive py-4" role="alert">
            Could not load staff salaries — try refreshing the page.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Monthly salary</TableHead>
                <TableHead>Effective since</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {salariesLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : salaries && salaries.length > 0 ? (
                salaries.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{staffLabel(s.staff)}</TableCell>
                    <TableCell>
                      {editingSalaryId === s.staff_id ? (
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            className="w-32"
                            value={editingSalaryAmount}
                            onChange={(e) => setEditingSalaryAmount(e.target.value)}
                            autoFocus
                          />
                          <Button size="sm" onClick={() => saveEditedSalary(s.staff_id)} disabled={isSavingSalary}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSalaryId(null);
                              setEditingSalaryAmount("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        formatMinor(s.monthly_amount_minor)
                      )}
                    </TableCell>
                    <TableCell>{s.effective_from}</TableCell>
                    <TableCell>
                      {editingSalaryId !== s.staff_id && (
                        <RowActionsMenu
                          label={staffLabel(s.staff)}
                          actions={[
                            {
                              label: "Edit salary",
                              onSelect: () => {
                                setEditingSalaryId(s.staff_id);
                                setEditingSalaryAmount(String(s.monthly_amount_minor / 100));
                              },
                            },
                            {
                              label: "Remove from payroll",
                              destructive: true,
                              separatorBefore: true,
                              onSelect: () =>
                                setRemoveFromPayrollTarget({ staffId: s.staff_id, label: staffLabel(s.staff) }),
                            },
                          ]}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No staff salaries set yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
        <div className="flex gap-2 items-end flex-wrap pt-1">
          <Select value={salaryStaffId} onValueChange={setSalaryStaffId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Add salary for staff" />
            </SelectTrigger>
            <SelectContent>
              {staffList?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.profiles?.email ?? s.id} ({s.designation})
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
          <Button onClick={addSalary} disabled={isSavingSalary}>
            Set salary
          </Button>
        </div>
      </section>

      {/* 2. Monthly Payroll */}
      <section className="card-elevated p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading font-semibold text-lg">Monthly Payroll</h2>
          <InfoHelp
            title="Monthly Payroll"
            content={{
              purpose: "Generate a draft payslip for every staff member for a given month, then finalize and pay it.",
              steps: [
                "Pick a month and select Generate draft.",
                "Review each staff member's base pay, adjustments, and net pay below.",
                "Add any bonuses, advances, or deductions in the Salary Adjustments section while the run is a draft.",
                "Select Finalize run when the amounts are correct — this locks them.",
                "Once finalized, choose a payment method and select Mark paid for each staff member as you pay them.",
              ],
              rules: [
                "You cannot generate two drafts for the same month.",
                "Adjustments can only be added before a run is finalized.",
              ],
            }}
          />
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <Input type="month" value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          <Button onClick={generateRun}>Generate draft</Button>
          <Select value={selectedRunId} onValueChange={setSelectedRunId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="View a payroll run" />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Base salary</TableHead>
                <TableHead>Adjustments</TableHead>
                <TableHead>Net pay</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payslipsError ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-destructive py-6" role="alert">
                    Could not load this payroll run — try refreshing the page.
                  </TableCell>
                </TableRow>
              ) : payslipsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : payslips && payslips.length > 0 ? (
                payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{staffLabel(p.staff)}</TableCell>
                    <TableCell>{formatMinor(p.base_amount_minor)}</TableCell>
                    <TableCell>{formatMinor(p.adjustments_total_minor)}</TableCell>
                    <TableCell className="font-medium">{formatMinor(p.net_amount_minor)}</TableCell>
                    <TableCell>
                      {p.paid_at ? (
                        <StatusBadge status="paid" />
                      ) : (
                        <StatusBadge status="pending" />
                      )}
                    </TableCell>
                    <TableCell>
                      {selectedRun?.status === "finalized" && !p.paid_at && (
                        <div className="flex gap-2 items-center">
                          <Select
                            value={paymentMethods[p.id] ?? "cash"}
                            onValueChange={(v) =>
                              setPaymentMethods((prev) => ({ ...prev, [p.id]: v as PayrollPaymentMethod }))
                            }
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PAYROLL_PAYMENT_METHODS.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {PAYROLL_PAYMENT_METHOD_LABELS[m]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => markPaid(p.id)}>
                            Mark paid
                          </Button>
                        </div>
                      )}
                      {p.paid_at && p.payment_method && (
                        <span className="text-sm text-muted-foreground">
                          via {PAYROLL_PAYMENT_METHOD_LABELS[p.payment_method]}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No payslips in this run yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      {/* 3. Salary Adjustments */}
      {selectedRunId && (
        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-semibold text-lg">Salary Adjustments</h2>
            <InfoHelp
              title="Salary Adjustments"
              content={{
                purpose: "Bonuses, advances, and deductions are one-off amounts added to a single staff member's pay for this month only.",
                steps: [
                  "Choose a staff member, the kind of adjustment, an amount, and a short reason.",
                  "Select Add — it updates that staff member's net pay in Monthly Payroll immediately.",
                ],
                rules: [
                  `${ADJUSTMENT_KIND_LABELS.bonus}: ${ADJUSTMENT_KIND_EXPLANATIONS.bonus}`,
                  `${ADJUSTMENT_KIND_LABELS.advance}: ${ADJUSTMENT_KIND_EXPLANATIONS.advance}`,
                  `${ADJUSTMENT_KIND_LABELS.deduction}: ${ADJUSTMENT_KIND_EXPLANATIONS.deduction}`,
                  "Adjustments can only be added while the run is still a draft, and cannot currently be edited or removed once added — a mistake needs a correcting adjustment in a later run.",
                ],
              }}
            />
          </div>

          {selectedRun?.status === "draft" && (
            <div className="flex gap-2 items-end flex-wrap">
              <Select value={adjStaffId} onValueChange={setAdjStaffId}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staffList?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profiles?.email ?? s.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={adjKind} onValueChange={(v) => setAdjKind(v as AdjustmentKind)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Kind" />
                </SelectTrigger>
                <SelectContent>
                  {ADJUSTMENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {ADJUSTMENT_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
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
                {isAddingAdjustment ? "Adding…" : "Add"}
              </Button>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff member</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adjustmentsError ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-destructive py-6" role="alert">
                    Could not load adjustments for this run — try refreshing the page.
                  </TableCell>
                </TableRow>
              ) : adjustmentsLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : adjustments && adjustments.length > 0 ? (
                adjustments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{staffLabel(a.staff)}</TableCell>
                    <TableCell>{ADJUSTMENT_KIND_LABELS[a.kind]}</TableCell>
                    <TableCell>{formatMinor(a.amount_minor)}</TableCell>
                    <TableCell className="text-muted-foreground">{a.reason}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No bonuses, advances, or deductions added to this run yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      )}

      {/* 4. Payroll Summary */}
      {selectedRunId && payslips && payslips.length > 0 && (
        <section className="card-elevated p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-semibold text-lg">Payroll Summary</h2>
            <InfoHelp
              title="Payroll Summary"
              content={{
                purpose: "Totals for the payroll run selected above, calculated from the same payslips shown in Monthly Payroll.",
                steps: ["Select a different run above to see its summary."],
                rules: [
                  "\"Disbursed\" is the amount already marked paid. \"Remaining\" is net pay not yet marked paid — it does not mean payment has been scheduled.",
                ],
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">Base salaries</p>
              <p className="text-xl font-semibold">{formatMinor(summary.baseTotalMinor)}</p>
              <p className="text-xs text-muted-foreground">{summary.staffCount} staff members</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">Adjustments</p>
              <p className="text-xl font-semibold">{formatMinor(summary.adjustmentsTotalMinor)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">Net payroll</p>
              <p className="text-xl font-semibold">{formatMinor(summary.netTotalMinor)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">Disbursed so far</p>
              <p className="text-xl font-semibold">{formatMinor(summary.disbursedTotalMinor)}</p>
              <p className="text-xs text-muted-foreground">
                {summary.disbursedCount} of {summary.staffCount} paid · {formatMinor(summary.remainingTotalMinor)} remaining
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 5. Payroll History */}
      <section className="card-elevated p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading font-semibold text-lg">Payroll History</h2>
          <InfoHelp
            title="Payroll History"
            content={{
              purpose: "Every payroll run ever generated, with its month and current status.",
              steps: ["Select View to open a past run in Monthly Payroll above."],
              rules: [
                "Draft: amounts can still change — adjustments can be added.",
                "Finalized: amounts are locked. Individual payslips may or may not be paid yet.",
              ],
            }}
          />
        </div>
        {runsError ? (
          <p className="text-sm text-destructive py-4" role="alert">
            Could not load payroll history — try refreshing the page.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runsLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : runs && runs.length > 0 ? (
                runs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.period_month}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={selectedRunId === r.id ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSelectedRunId(r.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No payroll runs generated yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </section>

      <AlertDialog
        open={!!removeFromPayrollTarget}
        onOpenChange={(open) => !open && setRemoveFromPayrollTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeFromPayrollTarget?.label} from payroll?</AlertDialogTitle>
            <AlertDialogDescription>
              They will not be included in any payroll run generated from now on. Every past payslip
              and salary adjustment for them is kept exactly as it is — nothing is deleted, and already
              disbursed amounts stay on record. This only stops future payroll processing; it does not
              deactivate their staff account or sign-in access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={removeFromPayroll}
            >
              Remove from payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
