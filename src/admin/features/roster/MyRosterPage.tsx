import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function MyRosterPage() {
  const supabase = getSupabaseClient();

  // teacher_roster is security_invoker: RLS on the underlying
  // teacher_subject_assignments/students tables scopes this to exactly the
  // caller's own active assignments — no extra filtering needed here.
  const { data: roster } = useQuery({
    queryKey: ["my_roster"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teacher_roster").select("*");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">My Roster</h1>
        <p className="text-muted-foreground">
          Students in the sections and subjects currently assigned to you.
        </p>
      </div>

      {roster?.length === 0 ? (
        <div className="card-elevated p-10 flex flex-col items-center text-center gap-3">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading font-semibold text-lg text-foreground">No assignments yet</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              You'll see your students here once the principal assigns you to a section and
              subject under Teacher Assignments.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60 hover:bg-muted/60">
                <TableHead>Student</TableHead>
                <TableHead>Admission No.</TableHead>
                <TableHead>Class / Section</TableHead>
                <TableHead>Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roster?.map((r) => (
                <TableRow key={`${r.student_id}-${r.subject_id}`}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="font-mono text-sm">{r.admission_no}</TableCell>
                  <TableCell>
                    {r.class_name} - {r.section_name}
                  </TableCell>
                  <TableCell>{r.subject_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
