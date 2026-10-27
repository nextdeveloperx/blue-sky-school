import { motion } from "framer-motion";

const SECTIONS = [
  {
    heading: "What this policy covers",
    body: [
      "This policy explains what information Blue Sky School collects through this website and our school management system, why we collect it, and how it's protected — for visitors browsing the public site, parents using the Family Dashboard, and staff using the admin system.",
    ],
  },
  {
    heading: "Information we collect",
    body: [
      "Public visitors: if you submit an admissions enquiry or the contact form, we collect the details you provide (such as your name and contact information) so the school can respond to you.",
      "Parents: creating a Family Dashboard account collects your name, email, and password (handled securely by our authentication provider, Supabase — we never see or store your password in plain text). Linking to a child's record requires school staff to verify the relationship before any student information becomes visible to you.",
      "Students: academic records (marks, results, attendance where applicable) and fee/payment records are maintained by the school for enrolled students and are only visible to the student's verified parent and authorized school staff.",
      "Staff: accounts are created only by the principal through an invitation; we store the staff information needed to run the school (role, designation, payroll where applicable).",
      "Sign-in: you may sign in with an email and password, or with Google. If you use Google, we receive only the basic profile information Google provides (name, email) to create your account — we never see your Google password.",
    ],
  },
  {
    heading: "How we use this information",
    body: [
      "To operate the school management system: recording attendance, marks, fees, payments, and payroll; verifying parent-child relationships before sharing any student information; and responding to admissions and contact enquiries.",
      "We do not sell personal information to third parties, and we do not use student or parent data for advertising.",
    ],
  },
  {
    heading: "Who can see what",
    body: [
      "Access is strictly role-based and enforced at the database level, not just hidden in the app's interface. A parent can only ever see their own verified child's published results, fees, and payments — never any other student's. Teachers see only the students and marks relevant to their assignments. Only the principal and accountant have access to financial and staff records.",
      "The public homepage shows only aggregate, anonymous statistics (such as total active student and teacher counts) — never individual names or records.",
    ],
  },
  {
    heading: "Data storage and security",
    body: [
      "School data is stored with Supabase, our database and authentication provider, which encrypts data in transit and at rest. Every significant change to financial records, roles, and account access is logged for audit purposes.",
    ],
  },
  {
    heading: "Cookies and local storage",
    body: [
      "This site uses your browser's local storage to keep you signed in between visits (via our authentication provider) and to remember minor preferences, such as your light/dark theme choice. We do not use third-party advertising or tracking cookies.",
    ],
  },
  {
    heading: "Your rights",
    body: [
      "Parents and staff may request a copy of, correction to, or deletion of their personal information by contacting the school at the email address below. Student academic and financial records are retained as required for school record-keeping, even if a related parent account is later removed.",
    ],
  },
  {
    heading: "Contact us",
    body: [
      "For any privacy-related question or request, email us at blueskyschool0@gmail.com.",
    ],
  },
];

const Privacy = () => {
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
              Privacy <span className="text-gradient">Policy</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              How Blue Sky School collects, uses, and protects your information.
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

export default Privacy;
