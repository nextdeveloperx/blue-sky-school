import { useEffect, useRef, useState } from "react";
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
import logo from "@/assets/blue-sky-school-logo.png";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.5-1.9 14.4-5.1l-6.6-5.6C29.6 35.1 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.6 5.6C40.8 36.6 44 31 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

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
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const navigate = useNavigate();
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Resolves and redirects from a signed-in user's ACTUAL user_roles rows
  // (RLS-scoped to themselves) — identical for password and Google sign-in,
  // so a Google account gets exactly the same "no role yet" safe state as a
  // password account with none. Nothing about how a role is granted changes:
  // this only ever reads existing user_roles rows, never creates one.
  async function resolveAndRedirect(userId: string) {
    const supabase = getSupabaseClient();
    const { data: roleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

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

    await resolveAndRedirect(data.user.id);
    setIsSubmitting(false);
  }

  // Google's own redirect takes the browser away and back to this page —
  // there is no synchronous response to branch on here, unlike the password
  // form above. `handledGoogleReturn` just prevents re-running the redirect
  // logic twice if Supabase's client fires more than one SIGNED_IN event for
  // the same returning session.
  const handledGoogleReturn = useRef(false);
  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user && !handledGoogleReturn.current) {
        handledGoogleReturn.current = true;
        resolveAndRedirect(session.user.id);
      }
    });
    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signInWithGoogle() {
    setIsGoogleSubmitting(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    // On success the browser navigates away immediately, so there is
    // nothing further to do here; only a pre-redirect failure (e.g. the
    // provider isn't configured in the Supabase dashboard yet) reaches
    // this toast — cancelling the Google popup/redirect itself is not
    // distinguishable from that here, so both surface the same message.
    if (error) {
      setIsGoogleSubmitting(false);
      toast.error(error.message || "Could not start Google sign-in. Try again or use email and password.");
    }
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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={signInWithGoogle}
        disabled={isGoogleSubmitting}
        aria-label="Continue with Google"
      >
        <GoogleIcon />
        {isGoogleSubmitting ? "Redirecting…" : "Continue with Google"}
      </Button>

      <p className="text-sm text-center">
        <Link to="/reset-password" className="text-primary hover:underline font-medium">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
