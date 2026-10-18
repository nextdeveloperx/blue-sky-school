import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { getSupabaseClient } from "@/lib/supabase/client";

const schema = z.object({
  admission_no: z.string().min(1, "Admission number is required"),
  child_full_name: z.string().min(1, "Child's name is required"),
});

type Values = z.infer<typeof schema>;

export default function LinkRequestPage() {
  const supabase = getSupabaseClient();
  const [submitted, setSubmitted] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { admission_no: "", child_full_name: "" },
  });

  async function onSubmit(values: Values) {
    const { error } = await supabase.rpc("request_student_link", {
      p_admission_no: values.admission_no,
      p_child_full_name: values.child_full_name,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSubmitted(true);
    form.reset();
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <h1 className="font-heading font-bold text-xl text-foreground">Link a child</h1>
      <p className="text-muted-foreground text-sm">
        Enter your child's admission number (from their admission letter) and full name. The
        school will review and verify this request before you see any of their information.
      </p>
      {submitted && (
        <p className="text-sm text-primary">
          Request submitted. You'll see it listed once reviewed by the school.
        </p>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="admission_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admission number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="child_full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Child's full name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            Submit request
          </Button>
        </form>
      </Form>
    </div>
  );
}
