import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MailCheck, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import logo from "@/assets/blue-sky-school-logo.png";
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
  fullName: z.string().min(1, "Your name is required"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type Values = z.infer<typeof schema>;

/**
 * The ONLY public self-registration route in the app. Deliberately parent-
 * only: signup_source is hardcoded to "portal" here, never read from a prop
 * or any client-settable value, so there is no path from this form to a
 * staff/admin role (handle_new_user grants 'parent' for signup_source
 * 'portal' and nothing else — see migration 21). Staff/teacher/accountant
 * accounts are provisioned only by principal-invitation (migration 29).
 */
export default function RegisterParentPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setIsSubmitting(true);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName, signup_source: "portal" },
      },
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setAwaitingConfirmation(true);
      return;
    }
    navigate("/portal", { replace: true });
  }

  if (awaitingConfirmation) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: "var(--hero-gradient)" }}
      >
        <div className="card-elevated max-w-sm w-full mx-auto p-8 space-y-5 text-center bg-card">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <MailCheck className="w-7 h-7 text-primary" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h1 className="font-heading font-bold text-xl text-foreground">Check your email</h1>
            <p className="text-muted-foreground text-sm">
              We've sent a confirmation link to your inbox. Click it to activate your account, then
              come back and sign in.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to="/login">Go to sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--hero-gradient)" }}
    >
      <div className="card-elevated max-w-sm w-full mx-auto p-8 space-y-6 bg-card">
        <div className="flex flex-col items-center text-center gap-2">
          <img src={logo} alt="Blue Sky School crest" className="w-12 h-12 object-contain" />
          <div className="flex items-center gap-1.5 text-primary">
            <GraduationCap className="w-4 h-4" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide">Family Portal</span>
          </div>
          <h1 className="font-heading font-bold text-xl text-foreground">Create your parent account</h1>
          <p className="text-muted-foreground text-sm">
            Track your child's results, fees, and payments in one place.
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your full name</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </Form>
        <p className="text-sm text-muted-foreground text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
