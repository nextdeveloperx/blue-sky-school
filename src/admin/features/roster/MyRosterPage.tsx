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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Admission No.</TableHead>
            <TableHead>Class / Section</TableHead>
            <TableHead>Subject</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster?.map((r) => (
            <TableRow key={`${r.student_id}-${r.subject_id}`}>
              <TableCell>{r.full_name}</TableCell>
              <TableCell>{r.admission_no}</TableCell>
              <TableCell>
                {r.class_name} - {r.section_name}
              </TableCell>
              <TableCell>{r.subject_name}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
