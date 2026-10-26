import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { UserPlus, GraduationCap, Wallet, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatMinor } from "@/lib/finance/money";

export default function PortalDashboardPage() {
  const supabase = getSupabaseClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  const { data: links } = useQuery({
    queryKey: ["my_links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parent_student_links")
        .select("*, students(full_name, admission_no)")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const verifiedLinks = links?.filter((l) => l.verification_status === "verified") ?? [];
  const activeStudentId = selectedStudentId || verifiedLinks[0]?.student_id || "";

  const { data: results } = useQuery({
    queryKey: ["my_child_results", activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select("*, exam_terms(name)")
        .eq("student_id", activeStudentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: dues } = useQuery({
    queryKey: ["my_child_dues", activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_schedules")
        .select("*")
        .eq("student_id", activeStudentId)
        .neq("status", "paid")
        .order("period_month");
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["my_child_payments", activeStudentId],
    enabled: !!activeStudentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", activeStudentId)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Family Dashboard</h1>
          <p className="text-muted-foreground">Your linked children.</p>
        </div>
        {links && links.length > 0 && (
          <Button asChild variant="outline">
            <Link to="/portal/link-child">Link a child</Link>
          </Button>
        )}
      </div>

      {links?.length === 0 && (
        <div className="card-elevated p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <UserPlus className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading font-semibold text-lg text-foreground">No children linked yet</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              Request access to your child's record. The school office reviews and verifies every
              request before you can see results, fees, and payments.
            </p>
          </div>
          <Button asChild className="mt-2">
            <Link to="/portal/link-child">Link a child</Link>
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {links?.map((l) => {
          const student = l.students as unknown as { full_name: string; admission_no: string } | null;
          return (
            <div key={l.id} className="card-elevated p-4 flex items-center justify-between">
              <div>
                <span className="font-medium">{student?.full_name}</span>{" "}
                <span className="text-muted-foreground text-sm">({student?.admission_no})</span>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={l.verification_status} />
                {l.verification_status === "verified" && (
                  <Button
                    size="sm"
                    variant={activeStudentId === l.student_id ? "default" : "outline"}
                    onClick={() => setSelectedStudentId(l.student_id)}
                  >
                    View
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeStudentId && (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" aria-hidden="true" />
              Results
            </h2>
            {results?.length === 0 && (
              <p className="text-muted-foreground text-sm">No published results yet.</p>
            )}
            {results?.map((r) => (
              <div key={r.id} className="card-elevated p-3">
                <div className="font-medium">
                  {(r.exam_terms as unknown as { name: string })?.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {r.total_obtained}/{r.total_max} ({r.percentage?.toFixed(1)}%) — Grade{" "}
                  {r.overall_grade}
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" aria-hidden="true" />
              Outstanding Fees
            </h2>
            {dues?.length === 0 && <p className="text-muted-foreground text-sm">No dues outstanding.</p>}
            {dues?.map((d) => (
              <div key={d.id} className="card-elevated p-3 flex items-center justify-between">
                <span className="text-sm">{d.period_month}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatMinor(d.amount_due_minor)}</span>
                  <StatusBadge status={d.status} />
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" aria-hidden="true" />
              Payment History
            </h2>
            <p className="text-muted-foreground text-xs">
              Recorded manually by the school office (cash, UPI, or bank transfer) — there is
              no online payment here.
            </p>
            {payments?.length === 0 && (
              <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
            )}
            {payments?.map((p) => (
              <div key={p.id} className="card-elevated p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">
                    {p.is_refund ? "Refund" : "Payment"} · {p.receipt_number}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.received_at).toLocaleDateString()} · {p.method.replace("_", " ")}
                  </div>
                </div>
                <span className="text-sm font-medium">{formatMinor(p.amount_minor)}</span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
