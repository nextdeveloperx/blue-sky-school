import { useEffect, useState } from "react";
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
import { ThemeToggle } from "@/lib/theme/ThemeToggle";

const schema = z.object({ password: z.string().min(6, "Password must be at least 6 characters") });
type Values = z.infer<typeof schema>;

/**
 * Reached via the link in a password-reset email. Supabase exchanges that
 * link for a temporary recovery session automatically (onAuthStateChange
 * fires PASSWORD_RECOVERY) before this component ever queries it — so the
 * only question here is whether a session actually exists, not how to
 * parse the URL ourselves.
 */
export default function UpdatePasswordPage() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updated, setUpdated] = useState(false);
  const navigate = useNavigate();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } });

  useEffect(() => {
    const supabase = getSupabaseClient();
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(values: Values) {
    setIsSubmitting(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setIsSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUpdated(true);
  }

  if (hasSession === false) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="max-w-sm w-full mx-auto space-y-4 text-center">
          <h1 className="font-heading font-bold text-xl text-foreground">Link expired</h1>
          <p className="text-muted-foreground text-sm">
            This password reset link is invalid or has expired. Request a new one.
          </p>
          <Link to="/reset-password" className="text-primary hover:underline font-medium">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  if (updated) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="max-w-sm w-full mx-auto space-y-4 text-center">
          <h1 className="font-heading font-bold text-xl text-foreground">Password updated</h1>
          <p className="text-muted-foreground text-sm">You can now sign in with your new password.</p>
          <Button className="w-full" onClick={() => navigate("/login", { replace: true })}>
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 bg-background">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="max-w-sm w-full mx-auto space-y-6">
        <h1 className="font-heading font-bold text-xl text-foreground text-center">
          Choose a new password
        </h1>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting || hasSession === null}>
              {isSubmitting ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
