import { motion } from "framer-motion";

const SECTIONS = [
  {
    heading: "Acceptance of terms",
    body: [
      "By using the Blue Sky School website, the Family Dashboard, or the admin system, you agree to these terms. If you're using the system on behalf of a school role (staff, principal, accountant), you also agree to follow the school's own internal policies for using it.",
    ],
  },
  {
    heading: "Accounts and access",
    body: [
      "Parent accounts are self-registered and gain access to a specific child's information only after the school verifies the parent-child relationship — creating an account does not, by itself, grant access to any student record.",
      "Staff accounts (teacher, accountant, principal) are created only by the principal through an invitation. Signing in with Google does not grant any elevated access beyond what your account would otherwise have — it's simply an alternate way to sign in.",
      "You're responsible for keeping your account credentials confidential and for all activity under your account. Tell us immediately at blueskyschool0@gmail.com if you suspect unauthorized access.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Use the system only for its intended purpose — school administration, academic records, fees and payments, and parent-school communication. Do not attempt to access records you're not authorized to see, interfere with the system's operation, or use it to submit false information.",
    ],
  },
  {
    heading: "Academic and financial records",
    body: [
      "Results, marks, fees, and payments recorded in this system are the official school record once approved and published through the school's internal review process. Published results and financial records are not altered retroactively except through the school's documented correction process, which is logged for audit purposes.",
    ],
  },
  {
    heading: "Admissions and contact enquiries",
    body: [
      "Submitting an admissions enquiry or contact form does not guarantee admission or a specific response time. The school will respond using the contact details you provide.",
    ],
  },
  {
    heading: "No warranty",
    body: [
      "This system is provided on an \"as is\" basis. While we take reasonable steps to keep it available and accurate, we don't guarantee uninterrupted access and aren't liable for indirect or consequential loss arising from its use.",
    ],
  },
  {
    heading: "Changes to these terms",
    body: [
      "We may update these terms from time to time to reflect changes to the system or school policy. Continued use after an update means you accept the revised terms.",
    ],
  },
  {
    heading: "Contact us",
    body: [
      "Questions about these terms can be sent to blueskyschool0@gmail.com.",
    ],
  },
];

const Terms = () => {
  return (
    <main className="pt-20">
      <section className="section-padding bg-muted">
        <div className="section-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="font-heading font-bold text-4xl md:text-5xl text-foreground mb-4">
              Terms &amp; <span className="text-gradient">Conditions</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              The terms for using the Blue Sky School website and school management system.
            </p>
            <p className="text-sm text-muted-foreground mt-2">Last updated: October 2026</p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding">
        <div className="section-container max-w-3xl mx-auto space-y-10">
          {SECTIONS.map((section, index) => (
            <motion.div
              key={section.heading}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            >
              <h2 className="font-heading font-bold text-2xl text-foreground mb-3">
                {section.heading}
              </h2>
              <div className="space-y-3">
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Terms;
