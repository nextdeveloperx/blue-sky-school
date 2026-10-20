import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  normalizePhone,
  isValidPhone,
  isValidEmail,
} from "@/lib/validation/enquiry";
import {
  CURRENT_ADMISSION_SESSION,
  APPLYING_CLASS_OPTIONS,
} from "@/lib/content/admissions";

// Mirrors the server-side checks in submit_admission_enquiry exactly —
// the database is still the real enforcement boundary (see the migration),
// this just gives a human a helpful message before any network round trip.
const schema = z.object({
  parentName: z.string().trim().min(2, "Enter the parent/guardian's name").max(120),
  phone: z
    .string()
    .min(1, "Enter a contact number")
    .refine((v) => isValidPhone(normalizePhone(v)), {
      message: "Enter a valid contact number, with country code if outside India",
    }),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || isValidEmail(v), { message: "Enter a valid email address" }),
  studentName: z.string().trim().max(120, "Student name is too long").optional(),
  applyingForClass: z.string().min(1, "Select the class you're applying for"),
  message: z.string().max(1000, "Message is too long (1000 characters max)"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consent to be contacted is required to submit an enquiry" }),
  }),
  // Honeypot — a real visitor never sees or fills this field.
  website: z.string().max(0).optional(),
});

type FormValues = z.infer<typeof schema>;

export function EnquiryForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      parentName: "",
      phone: "",
      email: "",
      studentName: "",
      applyingForClass: "",
      message: "",
      consent: false as true, // runtime default; zod only accepts the literal at validation time
      website: "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (isSubmitting) return; // guard against double-submit while a request is pending
    setIsSubmitting(true);
    setSubmitError(null);

    const supabase = getSupabaseClient();
    const { error } = await supabase.rpc("submit_admission_enquiry", {
      p_parent_name: values.parentName,
      p_phone: normalizePhone(values.phone),
      p_email: values.email.trim() === "" ? null : values.email.trim(),
      p_student_name: values.studentName?.trim() === "" ? null : values.studentName?.trim() ?? null,
      p_applying_for_class: values.applyingForClass,
      p_academic_session: CURRENT_ADMISSION_SESSION,
      p_message: values.message.trim() === "" ? null : values.message.trim(),
      p_consent: values.consent,
      p_idempotency_key: idempotencyKeyRef.current,
      p_honeypot: values.website ?? "",
    });

    setIsSubmitting(false);

    if (error) {
      // Never shown as success — this only runs when the enquiry was NOT saved.
      // Only surface the raw message for P0001 — Postgres's code for a plain
      // `raise exception` inside submit_admission_enquiry, i.e. one of our
      // own deliberately human-readable messages (bad phone, rate limit,
      // missing consent, ...). Anything else (a schema mismatch, a
      // constraint violation, a network failure) gets a generic message
      // instead of leaking internal error text to a public visitor.
      setSubmitError(
        error.code === "P0001"
          ? error.message
          : "Something went wrong submitting your enquiry. Please try again, or email us directly at blueskyschool0@gmail.com.",
      );
      return;
    }

    // Only reachable once Supabase confirms the row was actually created.
    setSubmitted(true);
    idempotencyKeyRef.current = crypto.randomUUID(); // fresh key for a possible next enquiry
    form.reset();
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-elevated p-8 text-center space-y-3"
        role="status"
      >
        <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
        <h3 className="font-heading font-bold text-xl text-foreground">Enquiry received</h3>
        <p className="text-muted-foreground">
          Thank you — our admissions team will reach out to you shortly.
        </p>
        <button type="button" className="btn-outline" onClick={() => setSubmitted(false)}>
          Submit another enquiry
        </button>
      </motion.div>
    );
  }

  return (
    <div className="card-elevated p-6 lg:p-8">
      <h2 className="font-heading font-bold text-2xl text-foreground mb-2">Admission Enquiry</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Share a few details and our admissions team will get back to you.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Honeypot — visually hidden, skipped by keyboard/screen readers,
              never shown to a real visitor. A filled value signals a bot. */}
          <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
            <label htmlFor="website">Leave this field blank</label>
            <input
              id="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...form.register("website")}
            />
          </div>

          <FormField
            control={form.control}
            name="parentName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Parent/Guardian Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input autoComplete="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Contact Number <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="tel" autoComplete="tel" placeholder="+91 98765 43210" {...field} />
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
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <FormField
              control={form.control}
              name="studentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Student's Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="applyingForClass"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Applying for Class <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a class" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {APPLYING_CLASS_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Preferred Academic Session
            </label>
            <Input value={CURRENT_ADMISSION_SESSION} disabled readOnly />
          </div>

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Anything you'd like us to know?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="consent"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start gap-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    id="enquiry-consent"
                  />
                </FormControl>
                <div>
                  <label htmlFor="enquiry-consent" className="text-sm text-foreground cursor-pointer">
                    I consent to Blue Sky School contacting me about this admission enquiry.{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          {submitError && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Submitting…"
            ) : (
              <>
                Submit Enquiry
                <Send className="ml-2 w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </Form>
    </div>
  );
}
