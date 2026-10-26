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
import { rupeesToMinor, formatMinor } from "@/lib/finance/money";
import { InfoHelp } from "@/components/InfoHelp";
import { StatusBadge } from "@/components/StatusBadge";
import { RowActionsMenu, type RowAction } from "@/components/RowActionsMenu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FeeStructure = {
  id: string;
  name: string;
  amount_minor: number;
  is_active: boolean;
  classes: { name: string } | null;
};

export default function FeesPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [className, setClassName] = useState("");
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FeeStructure | null>(null);
  const [deleteGuardCount, setDeleteGuardCount] = useState<number | null>(null);
  const [isCheckingDelete, setIsCheckingDelete] = useState(false);

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

  const { data: classes } = useQuery({
    queryKey: ["classes", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .eq("academic_year_id", currentYear!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: feeStructures } = useQuery({
    queryKey: ["fee_structures", currentYear?.id],
    enabled: !!currentYear,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_structures")
        .select("*, classes(name)")
        .eq("academic_year_id", currentYear!.id)
        .order("name");
      if (error) throw error;
      return data as unknown as FeeStructure[];
    },
  });

  function invalidateFees() {
    queryClient.invalidateQueries({ queryKey: ["fee_structures", currentYear?.id] });
  }

  async function saveEdit() {
    if (!editingFee) return;
    if (!editName.trim() || !editAmount) {
      toast.error("Name and amount are required");
      return;
    }
    const { error } = await supabase
      .from("fee_structures")
      .update({ name: editName.trim(), amount_minor: rupeesToMinor(editAmount) })
      .eq("id", editingFee.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fee structure updated");
    setEditingFee(null);
    invalidateFees();
  }

  async function openDeleteFlow(fee: FeeStructure) {
    setDeleteTarget(fee);
    setIsCheckingDelete(true);
    try {
      const { count, error } = await supabase
        .from("fee_schedules")
        .select("id", { count: "exact", head: true })
        .eq("fee_structure_id", fee.id);
      if (error) throw error;
      setDeleteGuardCount(count ?? 0);
    } catch {
      setDeleteGuardCount(1);
    } finally {
      setIsCheckingDelete(false);
    }
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteGuardCount(null);
    setIsCheckingDelete(false);
  }

  async function archiveFee(fee: FeeStructure) {
    const { error } = await supabase.from("fee_structures").update({ is_active: false }).eq("id", fee.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${fee.name} archived — hidden from new fee generation, history preserved`);
    closeDeleteDialog();
    invalidateFees();
  }

  async function reactivateFee(fee: FeeStructure) {
    const { error } = await supabase.from("fee_structures").update({ is_active: true }).eq("id", fee.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${fee.name} reactivated`);
    invalidateFees();
  }

  async function deleteFeePermanently() {
    if (!deleteTarget) return;
    const { error } = await supabase.from("fee_structures").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${deleteTarget.name} deleted`);
    closeDeleteDialog();
    invalidateFees();
  }

  function actionsForFee(f: FeeStructure): RowAction[] {
    const actions: RowAction[] = [
      { label: "Edit", onSelect: () => { setEditingFee(f); setEditName(f.name); setEditAmount(String(f.amount_minor / 100)); } },
    ];
    if (f.is_active) {
      actions.push({ label: "Delete / Archive", destructive: true, separatorBefore: true, onSelect: () => openDeleteFlow(f) });
    } else {
      actions.push({ label: "Reactivate", separatorBefore: true, onSelect: () => reactivateFee(f) });
    }
    return actions;
  }

  async function createFeeStructure() {
    if (!currentYear || !className || !feeName || !feeAmount) {
      toast.error("Class, name, and amount are required");
      return;
    }
    const { error } = await supabase.from("fee_structures").insert({
      academic_year_id: currentYear.id,
      class_id: className,
      name: feeName,
      amount_minor: rupeesToMinor(feeAmount),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Fee structure created");
    setFeeName("");
    setFeeAmount("");
    queryClient.invalidateQueries({ queryKey: ["fee_structures", currentYear.id] });
  }

  async function generateSchedules() {
    if (!currentYear) return;
    const { data, error } = await supabase.rpc("generate_monthly_fee_schedules", {
      p_academic_year_id: currentYear.id,
      p_period_month: `${periodMonth}-01`,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data === 0) {
      toast.success(
        `No new fee dues were needed for ${periodMonth} — every active student already had one.`,
      );
    } else {
      toast.success(
        `Created ${data} new fee due${data === 1 ? "" : "s"} for ${periodMonth}. Students who already had one for this month were left unchanged.`,
      );
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="font-heading font-bold text-2xl text-foreground">Fees</h1>
          <p className="text-muted-foreground">Set what each class owes, then create monthly dues.</p>
        </div>
        <InfoHelp
          title="Fees"
          content={{
            purpose:
              "Set how much each class owes per fee (like tuition), then create the amount each student owes for a given month. This does not record any payment — use the Payments page for that.",
            steps: [
              "Add a fee structure: pick a class, name the fee, and set the monthly amount.",
              "Pick a month and select \"Generate fee dues\".",
              "Review the summary message to see how many new dues were created.",
            ],
            rules: [
              "Only students marked active in the selected class get a due.",
              "Running this again for the same month never creates a second due for a student who already has one.",
              "This only creates the amount owed — it does not take any money. Record actual payments on the Payments page.",
            ],
            nextSteps:
              "New dues appear on each student's Payments page as outstanding, ready to be paid in full or in part.",
          }}
        />
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">Create an academic year first.</p>
      )}

      {currentYear && (
        <>
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">What each class owes</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount / month</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures?.map((f) => (
                  <TableRow key={f.id} className={f.is_active ? undefined : "opacity-60"}>
                    <TableCell>{f.classes?.name}</TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{formatMinor(f.amount_minor)}</TableCell>
                    <TableCell>
                      <StatusBadge status={f.is_active ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell>
                      <RowActionsMenu label={f.name} actions={actionsForFee(f)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex gap-2 items-end flex-wrap">
              <Select value={className} onValueChange={setClassName}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Class" />
                </SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Fee name (e.g. Tuition Fee)"
                className="w-48"
                value={feeName}
                onChange={(e) => setFeeName(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Amount (₹) per month"
                className="w-48"
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
              />
              <Button onClick={createFeeStructure}>Add fee structure</Button>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Create monthly fee dues</h2>
            <p className="text-muted-foreground text-sm">
              Create monthly fee dues for active students. Choose a month and select Generate.
              Students who already have a due for that month will not get a second one.
            </p>
            <div className="flex gap-2 items-end flex-wrap">
              <div>
                <label className="text-sm text-muted-foreground block mb-1">Select month</label>
                <Input
                  type="month"
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(e.target.value)}
                />
              </div>
              <Button onClick={generateSchedules}>Generate fee dues</Button>
            </div>
          </section>
        </>
      )}

      <Dialog open={!!editingFee} onOpenChange={(open) => !open && setEditingFee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingFee?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">Amount (₹) per month</label>
              <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFee(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && closeDeleteDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCheckingDelete
                ? "Checking whether any fee dues have been generated from this fee structure…"
                : deleteGuardCount && deleteGuardCount > 0
                  ? `${deleteGuardCount} fee due(s) already reference this structure. Deleting it would destroy that financial history, so permanent deletion is blocked. Archiving hides it from future fee generation while keeping all existing dues and payments intact.`
                  : "No fee dues reference this structure yet. It can be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeDeleteDialog}>Cancel</AlertDialogCancel>
            {!isCheckingDelete && deleteGuardCount !== null && deleteGuardCount > 0 ? (
              <AlertDialogAction onClick={() => deleteTarget && archiveFee(deleteTarget)}>
                Archive instead
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={deleteFeePermanently}
                disabled={isCheckingDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete permanently
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
