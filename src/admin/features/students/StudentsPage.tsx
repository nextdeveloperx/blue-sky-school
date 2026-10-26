import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { getSupabaseClient } from "@/lib/supabase/client";
import AddStudentDialog from "./AddStudentDialog";

export default function StudentsPage() {
  const supabase = getSupabaseClient();
  const [search, setSearch] = useState("");

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

  const filteredStudents = useMemo(() => {
    if (!students) return students;
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const sectionInfo = s.sections as unknown as {
        name: string;
        classes: { name: string } | null;
      } | null;
      const classSection = sectionInfo ? `${sectionInfo.classes?.name ?? ""} ${sectionInfo.name}` : "";
      return (
        s.full_name.toLowerCase().includes(q) ||
        s.admission_no.toLowerCase().includes(q) ||
        classSection.toLowerCase().includes(q)
      );
    });
  }, [students, search]);

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

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, admission no., or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>
      {students && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredStudents?.length ?? 0} of {students.length} students
        </p>
      )}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead>Admission No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Class / Section</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents?.map((s) => {
              const sectionInfo = s.sections as unknown as {
                name: string;
                classes: { name: string } | null;
              } | null;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-sm">{s.admission_no}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell>
                    {sectionInfo ? `${sectionInfo.classes?.name} - ${sectionInfo.name}` : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
