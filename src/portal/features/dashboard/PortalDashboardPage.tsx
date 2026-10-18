import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Parent Portal</h1>
          <p className="text-muted-foreground">Your linked children.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/portal/link-child">Link a child</Link>
        </Button>
      </div>

      {links?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No children linked yet. Use "Link a child" to request access.
        </p>
      )}

      <div className="space-y-2">
        {links?.map((l) => {
          const student = l.students as unknown as { full_name: string; admission_no: string } | null;
          return (
            <div key={l.id} className="card-elevated p-3 flex items-center justify-between">
              <div>
                <span className="font-medium">{student?.full_name}</span>{" "}
                <span className="text-muted-foreground text-sm">({student?.admission_no})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground capitalize">
                  {l.verification_status}
                </span>
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
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-2">
            <h2 className="font-heading font-semibold text-lg">Results</h2>
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

          <section className="space-y-2">
            <h2 className="font-heading font-semibold text-lg">Outstanding Fees</h2>
            {dues?.length === 0 && <p className="text-muted-foreground text-sm">No dues outstanding.</p>}
            {dues?.map((d) => (
              <div key={d.id} className="card-elevated p-3 flex justify-between">
                <span>{d.period_month}</span>
                <span className="text-sm text-muted-foreground">
                  {formatMinor(d.amount_due_minor)} ({d.status})
                </span>
              </div>
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
