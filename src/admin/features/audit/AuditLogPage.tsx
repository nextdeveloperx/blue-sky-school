import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function AuditLogPage() {
  const supabase = getSupabaseClient();

  const { data: entries } = useQuery({
    queryKey: ["audit_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*, profiles(email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: resultsAudit } = useQuery({
    queryKey: ["results_audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results_audit")
        .select("*, staff(profiles(email))")
        .order("changed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Audit Log</h1>
        <p className="text-muted-foreground">
          Financial and parent-verification events, plus result status transitions below. Marks
          edit history is attached to each student's record in Results Review.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="font-heading font-semibold text-lg">Financial &amp; Parent Link Events</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries?.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{new Date(e.created_at).toLocaleString()}</TableCell>
                <TableCell>{(e.profiles as unknown as { email: string } | null)?.email}</TableCell>
                <TableCell>{e.action}</TableCell>
                <TableCell>
                  {e.entity_type} ({e.entity_id.slice(0, 8)})
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading font-semibold text-lg">Result Status Transitions</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultsAudit?.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.changed_at).toLocaleString()}</TableCell>
                <TableCell>
                  {(r.staff as unknown as { profiles: { email: string } } | null)?.profiles?.email}
                </TableCell>
                <TableCell>{r.old_status ?? "—"}</TableCell>
                <TableCell>{r.new_status}</TableCell>
                <TableCell>{r.note}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
