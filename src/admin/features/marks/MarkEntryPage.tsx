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

export default function MarkEntryPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [termId, setTermId] = useState("");
  const [assignmentKey, setAssignmentKey] = useState(""); // `${section_id}|${subject_id}`
  const [scoreInputs, setScoreInputs] = useState<Record<string, { raw: string; max: string }>>({});

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

  const { data: terms } = useQuery({
    queryKey: ["exam_terms", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exam_terms")
        .select("*")
        .eq("academic_year_id", currentYear!.id)
        .eq("status", "open");
      if (error) throw error;
      return data;
    },
  });

  // Distinct section+subject combinations this teacher is actively assigned
  // to — sourced from the same security_invoker view as "My Roster".
  const { data: myAssignments } = useQuery({
    queryKey: ["my_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_roster")
        .select("section_id, subject_id, section_name, class_name, subject_name")
        .limit(500);
      if (error) throw error;
      const seen = new Set<string>();
      return (data ?? []).filter((r) => {
        const key = `${r.section_id}|${r.subject_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  const [sectionId, subjectId] = assignmentKey.split("|");

  const { data: roster } = useQuery({
    queryKey: ["roster_for_entry", sectionId, subjectId],
    enabled: !!sectionId && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_roster")
        .select("student_id, full_name, admission_no")
        .eq("section_id", sectionId)
        .eq("subject_id", subjectId);
      if (error) throw error;
      return data;
    },
  });

  const { data: existingMarks } = useQuery({
    queryKey: ["existing_marks", termId, subjectId],
    enabled: !!termId && !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marks")
        .select("*")
        .eq("exam_term_id", termId)
        .eq("subject_id", subjectId);
      if (error) throw error;
      return data;
    },
  });

  function getInput(studentId: string) {
    const existing = existingMarks?.find((m) => m.student_id === studentId);
    const override = scoreInputs[studentId];
    return {
      raw: override?.raw ?? (existing ? String(existing.raw_score) : ""),
      max: override?.max ?? (existing ? String(existing.max_score) : "100"),
    };
  }

  async function saveMark(studentId: string) {
    if (!termId || !sectionId || !subjectId) return;
    const input = getInput(studentId);
    const raw = Number(input.raw);
    const max = Number(input.max);
    if (!Number.isFinite(raw) || !Number.isFinite(max) || max <= 0 || raw < 0 || raw > max) {
      toast.error("Enter a valid score (0 ≤ raw ≤ max)");
      return;
    }

    const existing = existingMarks?.find((m) => m.student_id === studentId);
    const staffId = (await supabase.rpc("current_staff_id")).data as string;

    if (existing) {
      const { error } = await supabase
        .from("marks")
        .update({ raw_score: raw, max_score: max, updated_by: staffId, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("marks").insert({
        student_id: studentId,
        section_id: sectionId,
        subject_id: subjectId,
        exam_term_id: termId,
        raw_score: raw,
        max_score: max,
        entered_by: staffId,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
    }

    toast.success("Saved");
    queryClient.invalidateQueries({ queryKey: ["existing_marks", termId, subjectId] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Marks Entry</h1>
        <p className="text-muted-foreground">
          Only your assigned section + subject combinations are selectable — enforced server-side
          by RLS, not just this dropdown.
        </p>
      </div>

      <div className="flex gap-2 items-end flex-wrap">
        <Select value={termId} onValueChange={setTermId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Exam term" />
          </SelectTrigger>
          <SelectContent>
            {terms?.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignmentKey} onValueChange={setAssignmentKey}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Section + Subject" />
          </SelectTrigger>
          <SelectContent>
            {myAssignments?.map((a) => (
              <SelectItem key={`${a.section_id}|${a.subject_id}`} value={`${a.section_id}|${a.subject_id}`}>
                {a.class_name} - {a.section_name} · {a.subject_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {termId && sectionId && subjectId && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Raw score</TableHead>
              <TableHead>Max score</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster?.map((r) => {
              const input = getInput(r.student_id);
              return (
                <TableRow key={r.student_id}>
                  <TableCell>
                    {r.full_name} ({r.admission_no})
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={input.raw}
                      onChange={(e) =>
                        setScoreInputs((prev) => ({
                          ...prev,
                          [r.student_id]: { ...input, raw: e.target.value },
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      className="w-24"
                      value={input.max}
                      onChange={(e) =>
                        setScoreInputs((prev) => ({
                          ...prev,
                          [r.student_id]: { ...input, max: e.target.value },
                        }))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="sm" onClick={() => saveMark(r.student_id)}>
                      Save
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
