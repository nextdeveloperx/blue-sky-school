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
import AddStudentDialog from "./AddStudentDialog";

export default function StudentsPage() {
  const supabase = getSupabaseClient();

  const { data: currentYear } = useQuery({
    queryKey: ["current_academic_year"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("is_current", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: students } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*, sections(name, classes(name))")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Students</h1>
          <p className="text-muted-foreground">Admission and records.</p>
        </div>
        {currentYear && <AddStudentDialog academicYearId={currentYear.id} />}
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">
          Create an academic year under Academic Setup before admitting students.
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Admission No.</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Class / Section</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students?.map((s) => {
            const sectionInfo = s.sections as unknown as {
              name: string;
              classes: { name: string } | null;
            } | null;
            return (
              <TableRow key={s.id}>
                <TableCell>{s.admission_no}</TableCell>
                <TableCell>{s.full_name}</TableCell>
                <TableCell>
                  {sectionInfo ? `${sectionInfo.classes?.name} - ${sectionInfo.name}` : "—"}
                </TableCell>
                <TableCell>{s.status}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
