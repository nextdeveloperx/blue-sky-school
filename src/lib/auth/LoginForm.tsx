import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
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
import { resolveRoleRedirect } from "@/lib/auth/resolveRoleRedirect";
import type { AppRole } from "@/lib/auth/useSession";
import logo from "@/assets/blue-sky-school-logo.jpg";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

/**
 * The one sign-in form for every account type (principal, accountant,
 * teacher, parent). There is deliberately no role selector here — after
 * Supabase Auth confirms the password, the redirect is decided entirely by
 * querying `user_roles` (RLS-scoped to the signed-in user's own rows), never
 * by anything the client supplies. An account with no role row is shown a
 * safe "no access" state with a sign-out path, not redirected anywhere.
 */
export function LoginForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const navigate = useNavigate();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setIsSubmitting(true);
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) {
      setIsSubmitting(false);
      toast.error(error.message);
      return;
    }

    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    setIsSubmitting(false);

    if (roleError) {
      toast.error(roleError.message);
      return;
    }

    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    const redirectTo = resolveRoleRedirect(roles);

    if (!redirectTo) {
      setUnauthorized(true);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setUnauthorized(false);
    form.reset();
  }

  if (unauthorized) {
    return (
      <div className="max-w-sm w-full mx-auto space-y-4 text-center">
        <h1 className="font-heading font-bold text-xl text-foreground">
          No dashboard access yet
        </h1>
        <p className="text-muted-foreground text-sm">
          Your account signed in successfully, but it isn't assigned to any school role yet.
          Contact the school office if you believe this is a mistake.
        </p>
        <Button variant="outline" className="w-full" onClick={signOut}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-sm w-full mx-auto space-y-6">
      <div className="flex flex-col items-center gap-2">
        <img src={logo} alt="Blue Sky School crest" className="w-16 h-16 object-contain" />
        <h1 className="font-heading font-bold text-xl text-foreground text-center">
          Blue Sky School
        </h1>
      </div>
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
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Form>
      <p className="text-sm text-center">
        <Link to="/reset-password" className="text-primary hover:underline font-medium">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
