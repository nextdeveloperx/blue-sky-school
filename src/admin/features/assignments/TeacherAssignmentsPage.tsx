import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export default function TeacherAssignmentsPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");

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

  const { data: sections } = useQuery({
    queryKey: ["sections_for_year", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, name, classes!inner(name, academic_year_id)")
        .eq("classes.academic_year_id", currentYear!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("academic_year_id", currentYear!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ["teacher_staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, designation, profiles(email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments } = useQuery({
    queryKey: ["teacher_subject_assignments", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_subject_assignments")
        .select(
          "id, effective_from, effective_to, sections(name, classes(name)), subjects(name), staff(designation, profiles(email))",
        )
        .eq("academic_year_id", currentYear!.id)
        .is("effective_to", null);
      if (error) throw error;
      return data;
    },
  });

  async function createAssignment() {
    if (!currentYear || !sectionId || !subjectId || !teacherId) {
      toast.error("Select a section, subject, and teacher");
      return;
    }
    const { error } = await supabase.from("teacher_subject_assignments").insert({
      academic_year_id: currentYear.id,
      section_id: sectionId,
      subject_id: subjectId,
      teacher_staff_id: teacherId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assignment created");
    setSectionId("");
    setSubjectId("");
    setTeacherId("");
    queryClient.invalidateQueries({ queryKey: ["teacher_subject_assignments", currentYear.id] });
  }

  async function endAssignment(id: string) {
    const { error } = await supabase
      .from("teacher_subject_assignments")
      .update({ effective_to: new Date().toISOString().slice(0, 10) })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Assignment ended");
    queryClient.invalidateQueries({ queryKey: ["teacher_subject_assignments", currentYear?.id] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Teacher Assignments</h1>
        <p className="text-muted-foreground">
          Who teaches which section + subject this academic year. Ending an assignment lets a new
          one replace it — history is preserved, never overwritten.
        </p>
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">Create an academic year first.</p>
      )}

      {currentYear && (
        <div className="flex gap-2 items-end flex-wrap">
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Section" />
            </SelectTrigger>
            <SelectContent>
              {sections?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {(s.classes as unknown as { name: string })?.name} - {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {(t.profiles as unknown as { email: string })?.email} ({t.designation})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={createAssignment}>Assign</Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Section</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Teacher</TableHead>
            <TableHead>Since</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments?.map((a) => {
            const section = a.sections as unknown as { name: string; classes: { name: string } };
            const subject = a.subjects as unknown as { name: string };
            const staffMember = a.staff as unknown as {
              designation: string | null;
              profiles: { email: string } | null;
            };
            return (
              <TableRow key={a.id}>
                <TableCell>
                  {section?.classes?.name} - {section?.name}
                </TableCell>
                <TableCell>{subject?.name}</TableCell>
                <TableCell>{staffMember?.profiles?.email}</TableCell>
                <TableCell>{a.effective_from}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => endAssignment(a.id)}>
                    End
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
