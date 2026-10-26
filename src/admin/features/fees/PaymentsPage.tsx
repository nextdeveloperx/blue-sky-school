import { useMemo, useState } from "react";
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
import { formatMinor, isValidMinor, sumMinor } from "@/lib/finance/money";
import { StatusBadge } from "@/components/StatusBadge";
import { InfoHelp } from "@/components/InfoHelp";
import { StudentSearchCombobox, type StudentSearchResult } from "./StudentSearchCombobox";
import { Search } from "lucide-react";

type PaymentMethod = "cash" | "upi" | "bank_transfer";

export default function PaymentsPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [studentId, setStudentId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [referenceNote, setReferenceNote] = useState("");
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  function selectStudent(student: StudentSearchResult) {
    setSelectedStudent(student);
    setStudentId(student.id);
    setAllocationInputs({});
    setReferenceNote("");
  }

  const { data: outstanding } = useQuery({
    queryKey: ["outstanding_fee_schedules", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_schedules")
        .select("*, fee_structures(name)")
        .eq("student_id", studentId)
        .neq("status", "paid")
        .order("period_month");
      if (error) throw error;
      return data;
    },
  });

  const { data: recentPayments } = useQuery({
    queryKey: ["payments_for_student", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", studentId)
        .order("received_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const totalAmountMinor = useMemo(() => {
    return sumMinor(
      Object.values(allocationInputs)
        .map((v) => Math.round(Number(v || 0) * 100))
        .filter((v) => Number.isFinite(v) && v > 0),
    );
  }, [allocationInputs]);

  async function submitPayment() {
    // Re-entrancy guard: belt-and-suspenders alongside the disabled button
    // below — a stray double-invocation (e.g. a fast Enter-key repeat
    // before re-render) is a no-op rather than a second request.
    if (isSubmittingPayment) return;

    const allocations = Object.entries(allocationInputs)
      .map(([feeScheduleId, value]) => ({
        fee_schedule_id: feeScheduleId,
        amount_minor: Math.round(Number(value || 0) * 100),
      }))
      .filter((a) => a.amount_minor > 0);

    if (allocations.length === 0) {
      toast.error("Enter an amount against at least one due item");
      return;
    }
    if (!allocations.every((a) => isValidMinor(a.amount_minor))) {
      toast.error("Invalid amount entered");
      return;
    }

    setIsSubmittingPayment(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.rpc("record_payment", {
        p_student_id: studentId,
        p_method: method,
        p_amount_minor: totalAmountMinor,
        p_allocations: allocations,
        p_reference_note: referenceNote || null,
        p_idempotency_key: idempotencyKey,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const receipt = data?.[0]?.receipt_number;
      toast.success(`Payment recorded — receipt ${receipt}`);
      setAllocationInputs({});
      setReferenceNote("");
      queryClient.invalidateQueries({ queryKey: ["outstanding_fee_schedules", studentId] });
      queryClient.invalidateQueries({ queryKey: ["payments_for_student", studentId] });
    } finally {
      // Always clears, on both the success path and every early return
      // above that happens after the flag was set, and on a thrown error.
      setIsSubmittingPayment(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Payments</h1>
          <p className="text-muted-foreground">
            Record a payment, allocate it to due fees, and view the receipt.
          </p>
        </div>
        <InfoHelp
          title="Payments"
          content={{
            purpose:
              "Record money a student's family has actually paid, and apply it against their outstanding fee dues (in full or split across several months).",
            steps: [
              "Search for the student by name or admission number.",
              "Enter the amount being paid against one or more of their outstanding dues below.",
              "Choose how it was paid (cash, UPI, or bank transfer) and add a reference note if useful.",
              "Select \"Record payment\" — a receipt number is generated automatically.",
            ],
            rules: [
              "A due only shows here if it's not already fully paid.",
              "You can split one payment across several months at once, or pay part of a single due.",
              "Every payment is permanently recorded — there is no undo button here by design; refunds are not currently supported in this system.",
            ],
            nextSteps:
              "The due's status updates immediately (pending → partial → paid), and the payment appears in \"Recent payments\" below with its receipt number.",
          }}
        />
      </div>

      <StudentSearchCombobox
        value={studentId}
        selectedLabel={
          selectedStudent
            ? `${selectedStudent.admission_no} — ${selectedStudent.full_name}`
            : null
        }
        onSelect={selectStudent}
      />

      {!studentId && (
        <section className="card-elevated p-10 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
          <Search className="h-8 w-8 opacity-40" />
          <p>Search for a student to record a payment.</p>
        </section>
      )}

      {studentId && (
        <>
          <section className="card-elevated p-4 space-y-3">
            <h2 className="font-heading font-semibold text-lg">Outstanding dues</h2>
            {outstanding?.length === 0 && (
              <p className="text-muted-foreground text-sm">No dues outstanding.</p>
            )}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead>Fee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pay (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outstanding?.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{(o.fee_structures as unknown as { name: string })?.name}</TableCell>
                      <TableCell>{o.period_month}</TableCell>
                      <TableCell className="font-medium">{formatMinor(o.amount_due_minor)}</TableCell>
                      <TableCell>
                        <StatusBadge status={o.status} />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="w-28"
                          value={allocationInputs[o.id] ?? ""}
                          onChange={(e) =>
                            setAllocationInputs((prev) => ({ ...prev, [o.id]: e.target.value }))
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2 items-end flex-wrap pt-1">
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Reference note (e.g. UPI txn id)"
                className="w-64"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
              />
              <span className="text-sm font-medium text-foreground">
                Total: {formatMinor(totalAmountMinor)}
              </span>
              <Button
                onClick={submitPayment}
                disabled={totalAmountMinor <= 0 || isSubmittingPayment}
              >
                {isSubmittingPayment ? "Recording…" : "Record payment"}
              </Button>
            </div>
          </section>

          <section className="card-elevated p-4 space-y-3">
            <h2 className="font-heading font-semibold text-lg">Recent payments</h2>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60 hover:bg-muted/60">
                    <TableHead>Receipt</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments?.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">
                        {p.receipt_number} {p.is_refund && <span className="text-destructive">(refund)</span>}
                      </TableCell>
                      <TableCell className="font-medium">{formatMinor(p.amount_minor)}</TableCell>
                      <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                      <TableCell>{new Date(p.received_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
