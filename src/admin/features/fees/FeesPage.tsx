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

export default function FeesPage() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();

  const [className, setClassName] = useState("");
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));

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
        .eq("academic_year_id", currentYear!.id);
      if (error) throw error;
      return data;
    },
  });

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
    toast.success(`Generated ${data} fee schedule row(s) for ${periodMonth}`);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-2xl text-foreground">Fees</h1>
        <p className="text-muted-foreground">Monthly fee structures and schedule generation.</p>
      </div>

      {!currentYear && (
        <p className="text-muted-foreground text-sm">Create an academic year first.</p>
      )}

      {currentYear && (
        <>
          <section className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Fee Structures</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount / month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feeStructures?.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{(f.classes as unknown as { name: string })?.name}</TableCell>
                    <TableCell>{f.name}</TableCell>
                    <TableCell>{formatMinor(f.amount_minor)}</TableCell>
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
            <h2 className="font-heading font-semibold text-lg">Generate Monthly Schedules</h2>
            <p className="text-muted-foreground text-sm">
              Creates one due amount per active student per fee structure for the selected month.
              Safe to re-run — already-generated students are skipped.
            </p>
            <div className="flex gap-2 items-end">
              <Input
                type="month"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(e.target.value)}
              />
              <Button onClick={generateSchedules}>Generate for this month</Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
