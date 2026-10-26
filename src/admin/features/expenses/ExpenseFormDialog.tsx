import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { getSupabaseClient } from "@/lib/supabase/client";
import { rupeesToMinor } from "@/lib/finance/money";
import {
  expenseFormSchema,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type ExpenseFormValues,
} from "@/lib/expenses/expenseHelpers";

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface EditableExpense {
  id: string;
  title: string;
  category_id: string;
  incurred_on: string;
  amount_minor: number;
  payment_method: string;
  vendor: string | null;
  description: string | null;
  receipt_ref: string | null;
}

interface ExpenseFormDialogProps {
  categories: ExpenseCategory[];
  mode: "add" | "edit";
  expense?: EditableExpense;
  trigger?: ReactNode;
}

export default function ExpenseFormDialog({ categories, mode, expense, trigger }: ExpenseFormDialogProps) {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      title: "",
      category_id: "",
      incurred_on: new Date().toISOString().slice(0, 10),
      amount: "",
      payment_method: "cash",
      vendor: "",
      description: "",
      receipt_ref: "",
    },
  });

  // Re-sync the form whenever the dialog opens for an edit, or reset to a
  // blank slate when opening to add — avoids stale values from a previous
  // edit leaking into the next "Add expense" use of this same component.
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && expense) {
      form.reset({
        title: expense.title,
        category_id: expense.category_id,
        incurred_on: expense.incurred_on,
        amount: (expense.amount_minor / 100).toString(),
        payment_method: expense.payment_method as ExpenseFormValues["payment_method"],
        vendor: expense.vendor ?? "",
        description: expense.description ?? "",
        receipt_ref: expense.receipt_ref ?? "",
      });
    } else {
      form.reset({
        title: "",
        category_id: "",
        incurred_on: new Date().toISOString().slice(0, 10),
        amount: "",
        payment_method: "cash",
        vendor: "",
        description: "",
        receipt_ref: "",
      });
    }
  }, [open, mode, expense, form]);

  async function onSubmit(values: ExpenseFormValues) {
    const payload = {
      title: values.title.trim(),
      category_id: values.category_id,
      incurred_on: values.incurred_on,
      amount_minor: rupeesToMinor(values.amount),
      payment_method: values.payment_method,
      vendor: values.vendor?.trim() || null,
      description: values.description?.trim() || null,
      receipt_ref: values.receipt_ref?.trim() || null,
    };

    if (mode === "add") {
      const { data: staffId, error: staffError } = await supabase.rpc("current_staff_id");
      if (staffError || !staffId) {
        toast.error("Could not identify your staff record — contact the principal.");
        return;
      }
      const { error } = await supabase.from("expenses").insert({ ...payload, recorded_by: staffId as string });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Expense recorded");
    } else if (expense) {
      const { data: staffId, error: staffError } = await supabase.rpc("current_staff_id");
      if (staffError || !staffId) {
        toast.error("Could not identify your staff record — contact the principal.");
        return;
      }
      const { error } = await supabase
        .from("expenses")
        .update({ ...payload, updated_by: staffId as string, updated_at: new Date().toISOString() })
        .eq("id", expense.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Expense updated");
    }

    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="w-4 h-4" />
            Add expense
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Record an expense" : "Edit expense"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Electricity Bill" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="incurred_on"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (₹)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0.01" placeholder="0.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PAYMENT_METHODS.map((m) => (
                          <SelectItem key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="vendor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid to / Vendor (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. City Power Co." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description / Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receipt_ref"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receipt / bill reference (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Receipt number, invoice ID, or a link to the scanned bill" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Saving…"
                : mode === "add"
                  ? "Record expense"
                  : "Save changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
