import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowActionsMenu } from "@/components/RowActionsMenu";
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
  const [editingClass, setEditingClass] = useState<{ id: string; name: string } | null>(null);
  const [editingSection, setEditingSection] = useState<{ id: string; name: string } | null>(null);
  const [editingSubject, setEditingSubject] = useState<{ id: string; name: string } | null>(null);

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

  function friendlyDeleteError(error: { code?: string; message: string }, what: string) {
    if (error.code === "23503") {
      return `Can't delete this ${what} — students or other records still reference it. Move or remove those first.`;
    }
    return error.message;
  }

  async function deleteClass(classId: string) {
    if (!confirm("Delete this class and its sections? This can't be undone.")) return;
    const { error } = await supabase.from("classes").delete().eq("id", classId);
    if (error) {
      toast.error(friendlyDeleteError(error, "class"));
      return;
    }
    toast.success("Class deleted");
    queryClient.invalidateQueries({ queryKey: ["classes", currentYear?.id] });
  }

  async function deleteSection(sectionId: string) {
    if (!confirm("Delete this section? This can't be undone.")) return;
    const { error } = await supabase.from("sections").delete().eq("id", sectionId);
    if (error) {
      toast.error(friendlyDeleteError(error, "section"));
      return;
    }
    toast.success("Section deleted");
    queryClient.invalidateQueries({ queryKey: ["classes", currentYear?.id] });
  }

  async function deleteSubject(subjectId: string) {
    if (!confirm("Delete this subject? This can't be undone.")) return;
    const { error } = await supabase.from("subjects").delete().eq("id", subjectId);
    if (error) {
      toast.error(friendlyDeleteError(error, "subject"));
      return;
    }
    toast.success("Subject deleted");
    queryClient.invalidateQueries({ queryKey: ["subjects", currentYear?.id] });
  }

  async function renameClass() {
    if (!editingClass) return;
    if (!editingClass.name.trim()) {
      toast.error("Class name is required");
      return;
    }
    const { error } = await supabase
      .from("classes")
      .update({ name: editingClass.name.trim() })
      .eq("id", editingClass.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Class renamed");
    setEditingClass(null);
    queryClient.invalidateQueries({ queryKey: ["classes", currentYear?.id] });
  }

  async function renameSection() {
    if (!editingSection) return;
    if (!editingSection.name.trim()) {
      toast.error("Section name is required");
      return;
    }
    const { error } = await supabase
      .from("sections")
      .update({ name: editingSection.name.trim() })
      .eq("id", editingSection.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Section renamed");
    setEditingSection(null);
    queryClient.invalidateQueries({ queryKey: ["classes", currentYear?.id] });
  }

  async function renameSubject() {
    if (!editingSubject) return;
    if (!editingSubject.name.trim()) {
      toast.error("Subject name is required");
      return;
    }
    const { error } = await supabase
      .from("subjects")
      .update({ name: editingSubject.name.trim() })
      .eq("id", editingSubject.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Subject renamed");
    setEditingSubject(null);
    queryClient.invalidateQueries({ queryKey: ["subjects", currentYear?.id] });
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
                <div key={c.id} className="card-elevated p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    {editingClass?.id === c.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          autoFocus
                          className="h-8"
                          value={editingClass.name}
                          onChange={(e) => setEditingClass({ id: c.id, name: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && renameClass()}
                        />
                        <Button variant="ghost" size="icon" aria-label="Save" onClick={renameClass}>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Cancel"
                          onClick={() => setEditingClass(null)}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold">{c.name}</h3>
                        <RowActionsMenu
                          label={c.name}
                          actions={[
                            { label: "Edit", onSelect: () => setEditingClass({ id: c.id, name: c.name }) },
                            {
                              label: "Delete",
                              onSelect: () => deleteClass(c.id),
                              destructive: true,
                              separatorBefore: true,
                            },
                          ]}
                        />
                      </>
                    )}
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {(c.sections ?? []).map((s: { id: string; name: string }) => (
                      <li key={s.id} className="flex items-center justify-between">
                        {editingSection?.id === s.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              autoFocus
                              className="h-7"
                              value={editingSection.name}
                              onChange={(e) => setEditingSection({ id: s.id, name: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && renameSection()}
                            />
                            <Button variant="ghost" size="icon" aria-label="Save" onClick={renameSection}>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Cancel"
                              onClick={() => setEditingSection(null)}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span>Section {s.name}</span>
                            <RowActionsMenu
                              label={`Section ${s.name}`}
                              actions={[
                                {
                                  label: "Edit",
                                  onSelect: () => setEditingSection({ id: s.id, name: s.name }),
                                },
                                {
                                  label: "Delete",
                                  onSelect: () => deleteSection(s.id),
                                  destructive: true,
                                  separatorBefore: true,
                                },
                              ]}
                            />
                          </>
                        )}
                      </li>
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
              {subjects?.map((s) =>
                editingSubject?.id === s.id ? (
                  <li key={s.id} className="flex items-center gap-1">
                    <Input
                      autoFocus
                      className="h-7 w-36"
                      value={editingSubject.name}
                      onChange={(e) => setEditingSubject({ id: s.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && renameSubject()}
                    />
                    <Button variant="ghost" size="icon" className="h-5 w-5" aria-label="Save" onClick={renameSubject}>
                      <Check className="h-3 w-3 text-emerald-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      aria-label="Cancel"
                      onClick={() => setEditingSubject(null)}
                    >
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </li>
                ) : (
                  <li
                    key={s.id}
                    className="pl-3 pr-1 py-1 rounded-full bg-muted flex items-center gap-1"
                  >
                    {s.name}
                    <RowActionsMenu
                      label={s.name}
                      className="h-5 w-5"
                      actions={[
                        { label: "Edit", onSelect: () => setEditingSubject({ id: s.id, name: s.name }) },
                        {
                          label: "Delete",
                          onSelect: () => deleteSubject(s.id),
                          destructive: true,
                          separatorBefore: true,
                        },
                      ]}
                    />
                  </li>
                ),
              )}
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
