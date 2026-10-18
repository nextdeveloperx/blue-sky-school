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
import { rupeesToMinor, formatMinor, sumMinor } from "@/lib/finance/money";

export default function ExpensesPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [categoryName, setCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: expenses } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*, expense_categories(name)")
        .order("incurred_on", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const total = sumMinor((expenses ?? []).map((e) => e.amount_minor));

  async function createCategory() {
    if (!categoryName) return;
    const { error } = await supabase.from("expense_categories").insert({ name: categoryName });
    if (error) {
      toast.error(error.message);
      return;
    }
    setCategoryName("");
    queryClient.invalidateQueries({ queryKey: ["expense_categories"] });
  }

  async function createExpense() {
    const staffId = (await supabase.rpc("current_staff_id")).data as string;
    if (!categoryId || !amount || !incurredOn) {
      toast.error("Category, amount, and date are required");
      return;
    }
    const { error } = await supabase.from("expenses").insert({
      category_id: categoryId,
      amount_minor: rupeesToMinor(amount),
      incurred_on: incurredOn,
      description: description || null,
      recorded_by: staffId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expense recorded");
    setAmount("");
    setDescription("");
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Expenses</h1>
        <p className="text-muted-foreground">
          Total (last 100 records): {formatMinor(total)}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Categories</h2>
        <div className="flex gap-2 items-end">
          <Input
            placeholder="Category name (e.g. Maintenance)"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
          <Button variant="outline" onClick={createCategory}>
            Add category
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading font-semibold text-lg">Record Expense</h2>
        <div className="flex gap-2 items-end flex-wrap">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Amount (₹)"
            className="w-32"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            type="date"
            value={incurredOn}
            onChange={(e) => setIncurredOn(e.target.value)}
          />
          <Input
            placeholder="Description"
            className="w-56"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button onClick={createExpense}>Record</Button>
        </div>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses?.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.incurred_on}</TableCell>
              <TableCell>{(e.expense_categories as unknown as { name: string })?.name}</TableCell>
              <TableCell>{formatMinor(e.amount_minor)}</TableCell>
              <TableCell>{e.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
