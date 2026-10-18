import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  title: string;
  redirectTo: string;
}

export function LoginForm({ title, redirectTo }: LoginFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const navigate = useNavigate();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setIsSubmitting(true);
    const supabase = getSupabaseClient();

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp(values);
      setIsSubmitting(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      if (!data.session) {
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("sign-in");
        return;
      }
      navigate(redirectTo, { replace: true });
      return;
    }

    const { error } = await supabase.auth.signInWithPassword(values);
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="max-w-sm w-full mx-auto space-y-6">
      <h1 className="font-heading font-bold text-xl text-foreground text-center">{title}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "sign-up"
                ? "Creating account…"
                : "Signing in…"
              : mode === "sign-up"
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>
      </Form>
      <button
        type="button"
        className="text-sm text-muted-foreground hover:text-primary w-full text-center"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
      >
        {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
      </button>
    </div>
  );
}
