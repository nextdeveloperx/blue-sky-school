import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    // This site has no backend inbox to receive form submissions — rather
    // than fake a "message sent" confirmation, open the visitor's own email
    // client with the message pre-filled, so it's genuinely sent by them.
    //
    // For real enquiry tracking (a record of who asked what, without relying
    // on the visitor's own email client actually being configured — a mailto
    // link silently does nothing if it isn't), this would need: a Supabase
    // table (e.g. `enquiries`) + an insert-only RLS policy for anon/public
    // submissions, a way for staff to view/triage them (an admin page, akin
    // to the existing parent-link review queue), and ideally a notification
    // path (e.g. a Supabase database webhook or Edge Function emailing the
    // school on each new row). None of that exists today — explicitly out of
    // scope for this pass, which is public-site-only.
    const subject = encodeURIComponent(`Website enquiry from ${formData.name}`);
    const body = encodeURIComponent(
      `${formData.message}\n\n— ${formData.name} (${formData.email})`,
    );
    window.location.href = `mailto:blueskyschool0@gmail.com?subject=${subject}&body=${body}`;

    toast.success("Opening your email app to send this message to us.");
    setIsSubmitting(false);
  };

  return (
    <main className="pt-20">
      {/* Hero Section */}
      <section className="section-padding bg-muted">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-heading font-bold text-4xl md:text-5xl text-foreground mb-4">
              Contact <span className="text-gradient">Us</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              We'd love to hear from you. Get in touch with us!
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Content */}
      <section className="section-padding">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div>
                <h2 className="font-heading font-bold text-2xl text-foreground mb-4">
                  Get in Touch
                </h2>
                <p className="text-muted-foreground">
                  Have questions about admissions, academics, or anything else? 
                  We're here to help. Reach out to us through any of the following channels.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground mb-1">Email</h3>
                    <a 
                      href="mailto:blueskyschool0@gmail.com" 
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      blueskyschool0@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground mb-1">Phone</h3>
                    <p className="text-muted-foreground">+91 XXXXX XXXXX</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-foreground mb-1">Address</h3>
                    <p className="text-muted-foreground">
                      School Address Line 1<br />
                      City, State - PIN Code<br />
                      India
                    </p>
                  </div>
                </div>
              </div>

              {/* Map placeholder — the previous embed pinned a real but
                  UNRELATED location (a commercial complex in Pune,
                  verified by inspecting the resolved map), which actively
                  misled visitors rather than just looking unfinished.
                  Removed rather than replaced with another guess: wire in
                  a real embed URL for the actual campus once the school
                  confirms its address. */}
              <div className="rounded-xl border border-dashed border-border h-64 flex flex-col items-center justify-center gap-2 text-center p-6 bg-muted/50">
                <MapPin className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Campus map coming soon. Confirm our school address above or by email.
                </p>
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className="card-elevated p-6 lg:p-8">
                <h2 className="font-heading font-bold text-2xl text-foreground mb-6">
                  Send us a Message
                </h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      placeholder="Enter your name"
                      maxLength={100}
                      required
                      autoComplete="name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      placeholder="Enter your email"
                      maxLength={255}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-foreground mb-2">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows={5}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none"
                      placeholder="How can we help you?"
                      maxLength={1000}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      "Sending..."
                    ) : (
                      <>
                        Send Message
                        <Send className="ml-2 w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Contact;
