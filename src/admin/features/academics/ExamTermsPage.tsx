import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function ExamTermsPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

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
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: bands } = useQuery({
    queryKey: ["grade_scale", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grade_scale")
        .select("*")
        .eq("academic_year_id", currentYear!.id)
        .order("min_percent", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [termName, setTermName] = useState("");
  const [minPercent, setMinPercent] = useState("");
  const [maxPercent, setMaxPercent] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");

  async function createTerm() {
    if (!currentYear || !termName) {
      toast.error("Term name is required");
      return;
    }
    const { error } = await supabase
      .from("exam_terms")
      .insert({ academic_year_id: currentYear.id, name: termName });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Exam term created");
    setTermName("");
    queryClient.invalidateQueries({ queryKey: ["exam_terms", currentYear.id] });
  }

  async function createBand() {
    if (!currentYear || !minPercent || !maxPercent || !gradeLabel) {
      toast.error("Min %, max %, and grade label are required");
      return;
    }
    const { error } = await supabase.from("grade_scale").insert({
      academic_year_id: currentYear.id,
      min_percent: Number(minPercent),
      max_percent: Number(maxPercent),
      grade_label: gradeLabel,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Grade band added");
    setMinPercent("");
    setMaxPercent("");
    setGradeLabel("");
    queryClient.invalidateQueries({ queryKey: ["grade_scale", currentYear.id] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">
          Exam Terms &amp; Grade Scale
        </h1>
        <p className="text-muted-foreground">
          Terms (e.g. Term 1, Annual) and the percentage-to-grade bands used when results are
          computed.
        </p>
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">Create an academic year first.</p>
      )}

      {currentYear && (
        <>
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Exam Terms</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {terms?.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{t.name}</TableCell>
                    <TableCell>{t.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <Input
                placeholder="Term name (e.g. Term 1)"
                value={termName}
                onChange={(e) => setTermName(e.target.value)}
              />
              <Button onClick={createTerm}>Add term</Button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Grade Scale</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Min %</TableHead>
                  <TableHead>Max %</TableHead>
                  <TableHead>Grade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bands?.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{b.min_percent}</TableCell>
                    <TableCell>{b.max_percent}</TableCell>
                    <TableCell>{b.grade_label}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end">
              <Input
                type="number"
                placeholder="Min %"
                className="w-24"
                value={minPercent}
                onChange={(e) => setMinPercent(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Max %"
                className="w-24"
                value={maxPercent}
                onChange={(e) => setMaxPercent(e.target.value)}
              />
              <Input
                placeholder="Grade (e.g. A1)"
                className="w-32"
                value={gradeLabel}
                onChange={(e) => setGradeLabel(e.target.value)}
              />
              <Button onClick={createBand}>Add band</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
