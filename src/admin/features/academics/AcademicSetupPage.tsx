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

export default function AcademicSetupPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const { data: years } = useQuery({
    queryKey: ["academic_years"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const currentYear = years?.find((y) => y.is_current) ?? years?.[0];

  const { data: classes } = useQuery({
    queryKey: ["classes", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*, sections(*)")
        .eq("academic_year_id", currentYear!.id)
        .order("sort_order", { ascending: true });
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
        .eq("academic_year_id", currentYear!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const [yearLabel, setYearLabel] = useState("");
  const [yearStart, setYearStart] = useState("");
  const [yearEnd, setYearEnd] = useState("");
  const [className, setClassName] = useState("");
  const [sectionTargets, setSectionTargets] = useState<Record<string, string>>({});
  const [subjectName, setSubjectName] = useState("");

  async function createYear() {
    if (!yearLabel || !yearStart || !yearEnd) {
      toast.error("Label, start date and end date are required");
      return;
    }
    const { error } = await supabase.from("academic_years").insert({
      label: yearLabel,
      start_date: yearStart,
      end_date: yearEnd,
      is_current: !years || years.length === 0,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Academic year created");
    setYearLabel("");
    setYearStart("");
    setYearEnd("");
    queryClient.invalidateQueries({ queryKey: ["academic_years"] });
  }

  async function createClass() {
    if (!currentYear) {
      toast.error("Create an academic year first");
      return;
    }
    if (!className) {
      toast.error("Class name is required");
      return;
    }
    const { error } = await supabase
      .from("classes")
      .insert({ academic_year_id: currentYear.id, name: className });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class created");
    setClassName("");
    queryClient.invalidateQueries({ queryKey: ["classes", currentYear.id] });
  }

  async function createSubject() {
    if (!currentYear) {
      toast.error("Create an academic year first");
      return;
    }
    if (!subjectName) {
      toast.error("Subject name is required");
      return;
    }
    const { error } = await supabase
      .from("subjects")
      .insert({ academic_year_id: currentYear.id, name: subjectName });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subject created");
    setSubjectName("");
    queryClient.invalidateQueries({ queryKey: ["subjects", currentYear.id] });
  }

  async function createSection(classId: string) {
    const name = sectionTargets[classId];
    if (!name) {
      toast.error("Section name is required");
      return;
    }
    const { error } = await supabase.from("sections").insert({ class_id: classId, name });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Section created");
    setSectionTargets((prev) => ({ ...prev, [classId]: "" }));
    queryClient.invalidateQueries({ queryKey: ["classes", currentYear?.id] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Academic Setup</h1>
        <p className="text-muted-foreground">Academic years, classes, and sections.</p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Academic Years</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Current</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {years?.map((y) => (
              <TableRow key={y.id}>
                <TableCell>{y.label}</TableCell>
                <TableCell>{y.start_date}</TableCell>
                <TableCell>{y.end_date}</TableCell>
                <TableCell>{y.is_current ? "Yes" : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-sm text-muted-foreground">Label (e.g. 2026-27)</label>
            <Input value={yearLabel} onChange={(e) => setYearLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Start date</label>
            <Input type="date" value={yearStart} onChange={(e) => setYearStart(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">End date</label>
            <Input type="date" value={yearEnd} onChange={(e) => setYearEnd(e.target.value)} />
          </div>
          <Button onClick={createYear}>Add academic year</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">
          Classes &amp; Sections {currentYear ? `(${currentYear.label})` : ""}
        </h2>
        {!currentYear && (
          <p className="text-muted-foreground text-sm">Create an academic year first.</p>
        )}
        {currentYear && (
          <>
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-sm text-muted-foreground">Class name (e.g. Grade 5)</label>
                <Input value={className} onChange={(e) => setClassName(e.target.value)} />
              </div>
              <Button onClick={createClass}>Add class</Button>
            </div>
            <div className="space-y-4">
              {classes?.map((c) => (
                <div key={c.id} className="card-elevated p-4 space-y-2">
                  <h3 className="font-semibold">{c.name}</h3>
                  <ul className="text-sm text-muted-foreground">
                    {(c.sections ?? []).map((s: { id: string; name: string }) => (
                      <li key={s.id}>Section {s.name}</li>
                    ))}
                  </ul>
                  <div className="flex gap-2 items-end">
                    <Input
                      placeholder="Section name (e.g. A)"
                      value={sectionTargets[c.id] ?? ""}
                      onChange={(e) =>
                        setSectionTargets((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                    />
                    <Button variant="outline" onClick={() => createSection(c.id)}>
                      Add section
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">
          Subjects {currentYear ? `(${currentYear.label})` : ""}
        </h2>
        {!currentYear && (
          <p className="text-muted-foreground text-sm">Create an academic year first.</p>
        )}
        {currentYear && (
          <>
            <ul className="text-sm text-muted-foreground flex flex-wrap gap-2">
              {subjects?.map((s) => (
                <li key={s.id} className="px-3 py-1 rounded-full bg-muted">
                  {s.name}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 items-end">
              <div>
                <label className="text-sm text-muted-foreground">
                  Subject name (e.g. Mathematics)
                </label>
                <Input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
              </div>
              <Button onClick={createSubject}>Add subject</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
