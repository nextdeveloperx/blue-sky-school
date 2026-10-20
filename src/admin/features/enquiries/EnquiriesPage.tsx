import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/auth/useSession";
import { APPLYING_CLASS_OPTIONS } from "@/lib/content/admissions";
import type { Database } from "@/lib/supabase/types";

type Enquiry = Database["public"]["Tables"]["admission_enquiries"]["Row"];

const STATUSES = ["new", "contacted", "follow_up_required", "admitted", "closed"] as const;
const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  follow_up_required: "Follow-up Required",
  admitted: "Admitted",
  closed: "Closed",
};
const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  contacted: "secondary",
  follow_up_required: "outline",
  admitted: "default",
  closed: "outline",
};

const PAGE_SIZE = 20;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function EnquiriesPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const { roles } = useSession();
  const isPrincipal = roles.includes("principal");

  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Enquiry | null>(null);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, statusFilter, classFilter]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admission_enquiries", page, debouncedSearch, statusFilter, classFilter],
    queryFn: async () => {
      let query = supabase
        .from("admission_enquiries")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (classFilter !== "all") query = query.eq("applying_for_class", classFilter);
      if (debouncedSearch.trim() !== "") {
        const q = debouncedSearch.trim().replace(/[%,]/g, "");
        query = query.or(`parent_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  const { data: staffList } = useQuery({
    queryKey: ["staff_for_assignment"],
    enabled: isPrincipal,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff")
        .select("id, designation, profiles(email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admission_enquiries"] });
  }

  async function saveChanges(
    enquiryId: string,
    changes: {
      status?: string;
      assignedStaffId?: string | null;
      clearAssignment?: boolean;
      internalNotes?: string;
      followUpDate?: string | null;
    },
  ) {
    const { error } = await supabase.rpc("update_enquiry", {
      p_enquiry_id: enquiryId,
      p_status: changes.status ?? null,
      p_assigned_staff_id: changes.clearAssignment ? null : changes.assignedStaffId ?? null,
      p_clear_assignment: changes.clearAssignment ?? false,
      p_internal_notes: changes.internalNotes ?? null,
      p_follow_up_date: changes.followUpDate ?? null,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Enquiry updated");
    invalidate();
    return true;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Admission Enquiries</h1>
        <p className="text-muted-foreground">
          Public enquiries submitted through the website's Admissions page.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="text-sm text-muted-foreground mb-1 block">
            Search by name, phone, or email
          </label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search enquiries…"
          />
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Class</label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {APPLYING_CLASS_OPTIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading enquiries…</p>}
      {isError && (
        <p className="text-sm text-destructive">
          Couldn't load enquiries: {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}
      {!isLoading && !isError && data?.rows.length === 0 && (
        <p className="text-muted-foreground text-sm">No enquiries match these filters.</p>
      )}

      {!isLoading && !isError && data && data.rows.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parent</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelected(row)}
                >
                  <TableCell className="font-medium">{row.parent_name}</TableCell>
                  <TableCell>
                    <div className="text-sm">{row.phone}</div>
                    {row.email && <div className="text-xs text-muted-foreground">{row.email}</div>}
                  </TableCell>
                  <TableCell>{row.applying_for_class}</TableCell>
                  <TableCell>{row.academic_session}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[row.status] ?? "outline"}>
                      {STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(row.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages} — {data.count} total
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {selected && (
        <EnquiryDetailDialog
          enquiry={selected}
          isPrincipal={isPrincipal}
          staffList={staffList}
          onClose={() => setSelected(null)}
          onSave={saveChanges}
        />
      )}
    </div>
  );
}

interface EnquiryDetailDialogProps {
  enquiry: Enquiry;
  isPrincipal: boolean;
  staffList: { id: string; designation: string | null; profiles: { email: string } | null }[] | undefined;
  onClose: () => void;
  onSave: (
    enquiryId: string,
    changes: {
      status?: string;
      assignedStaffId?: string | null;
      clearAssignment?: boolean;
      internalNotes?: string;
      followUpDate?: string | null;
    },
  ) => Promise<boolean>;
}

function EnquiryDetailDialog({ enquiry, isPrincipal, staffList, onClose, onSave }: EnquiryDetailDialogProps) {
  const [status, setStatus] = useState(enquiry.status);
  const [assignedStaffId, setAssignedStaffId] = useState<string>(enquiry.assigned_staff_id ?? "unassigned");
  const [notes, setNotes] = useState(enquiry.internal_notes ?? "");
  const [followUpDate, setFollowUpDate] = useState(enquiry.follow_up_date ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmingAdmitted, setConfirmingAdmitted] = useState(false);

  async function handleSave(nextStatus: string) {
    if (isSaving) return;
    setIsSaving(true);
    const ok = await onSave(enquiry.id, {
      status: nextStatus,
      assignedStaffId: assignedStaffId === "unassigned" ? null : assignedStaffId,
      clearAssignment: assignedStaffId === "unassigned",
      internalNotes: notes,
      followUpDate: followUpDate === "" ? null : followUpDate,
    });
    setIsSaving(false);
    setConfirmingAdmitted(false);
    if (ok) onClose();
  }

  function handleSaveClick() {
    // A consequential, hard-to-walk-back status change gets one explicit
    // confirmation step rather than saving silently on click.
    if (status === "admitted" && enquiry.status !== "admitted") {
      setConfirmingAdmitted(true);
      return;
    }
    handleSave(status);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{enquiry.parent_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Phone</div>
              <div>{enquiry.phone}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Email</div>
              <div>{enquiry.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Student</div>
              <div>{enquiry.student_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Class / Session</div>
              <div>
                {enquiry.applying_for_class} / {enquiry.academic_session}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Submitted</div>
              <div>{new Date(enquiry.created_at).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last updated</div>
              <div>{new Date(enquiry.updated_at).toLocaleString()}</div>
            </div>
          </div>

          {enquiry.message && (
            <div>
              <div className="text-sm text-muted-foreground mb-1">Message</div>
              <p className="text-sm bg-muted/50 rounded-lg p-3">{enquiry.message}</p>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isPrincipal && (
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Assigned to</label>
              <Select value={assignedStaffId} onValueChange={setAssignedStaffId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {staffList?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.profiles?.email ?? s.id} {s.designation ? `(${s.designation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Only the principal may reassign an enquiry.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Follow-up date</label>
            <Input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Internal notes</label>
            <Textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Not visible to the parent — internal staff notes only."
              maxLength={4000}
            />
          </div>

          {confirmingAdmitted && (
            <div className="rounded-lg border border-accent bg-accent/10 p-3 text-sm space-y-2">
              <p>Mark this enquiry as <strong>Admitted</strong>? This is a significant status change.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleSave(status)} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Yes, mark as Admitted"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmingAdmitted(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!confirmingAdmitted && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveClick} disabled={isSaving}>
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
