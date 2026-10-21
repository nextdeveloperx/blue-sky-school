import { motion } from "framer-motion";
import { FileText, UserCheck, CheckCircle, Mail, ArrowRight } from "lucide-react";
import { CURRENT_ADMISSION_SESSION } from "@/lib/content/admissions";
import { EnquiryForm } from "@/components/admissions/EnquiryForm";

const steps = [
  {
    number: 1,
    title: "Inquiry",
    description: "Visit our campus or contact us via email/phone to learn about our programs and admission process.",
    icon: Mail,
  },
  {
    number: 2,
    title: "Required Documents",
    description: "Submit the application form along with required documents including birth certificate, previous school records, and passport-size photographs.",
    icon: FileText,
  },
  {
    number: 3,
    title: "Admission Confirmation",
    description: "Once your application is reviewed and approved, complete the fee payment to confirm your child's admission.",
    icon: UserCheck,
  },
];

const documents = [
  "Birth Certificate (original & copy)",
  "Previous School Records / Transfer Certificate",
  "4 Passport-size Photographs",
  "Aadhar Card (Parent & Student)",
  "Address Proof",
  "Immunization Records",
];

const Admissions = () => {
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
            <div className="inline-flex items-center gap-2 bg-accent/20 text-accent px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              Admissions Open for {CURRENT_ADMISSION_SESSION}
            </div>
            <h1 className="font-heading font-bold text-4xl md:text-5xl text-foreground mb-4">
              Join <span className="text-gradient">Blue Sky School</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Take the first step towards a bright future for your child
            </p>
          </motion.div>
        </div>
      </section>

      {/* Admission Process */}
      <section className="section-padding">
        <div className="section-container">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-bold text-3xl text-foreground text-center mb-12"
          >
            Admission Process
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.15 }}
                className="relative"
              >
                <div className="card-elevated p-6 lg:p-8 h-full">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-heading font-bold text-lg">
                      {step.number}
                    </div>
                    <step.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-xl text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-primary/30" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Admission Enquiry Form */}
      <section className="section-padding">
        <div className="section-container">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-10"
            >
              <h2 className="font-heading font-bold text-3xl text-foreground mb-4">
                Submit an <span className="text-gradient">Enquiry</span>
              </h2>
              <p className="text-muted-foreground">
                Prefer not to call or email directly? Fill in the form below and our
                admissions team will get in touch with you.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <EnquiryForm />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Required Documents */}
      <section className="section-padding bg-muted">
        <div className="section-container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="font-heading font-bold text-3xl text-foreground mb-6">
                Required Documents
              </h2>
              <p className="text-muted-foreground mb-6">
                Please ensure you have the following documents ready for the admission process:
              </p>
              <ul className="space-y-3">
                {documents.map((doc, index) => (
                  <motion.li
                    key={doc}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="flex items-center gap-3"
                  >
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{doc}</span>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="card-elevated p-8 bg-primary text-primary-foreground"
            >
              <h3 className="font-heading font-bold text-2xl mb-4">
                Contact for Admissions
              </h3>
              <p className="opacity-90 mb-6">
                Have questions about admissions? We're here to help! Reach out to us for any queries.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5" />
                  <a 
                    href="mailto:blueskyschool0@gmail.com" 
                    className="font-medium hover:underline"
                  >
                    blueskyschool0@gmail.com
                  </a>
                </div>
              </div>
              <div className="mt-8">
                <a
                  href="mailto:blueskyschool0@gmail.com?subject=Admission Inquiry"
                  className="btn-accent inline-flex"
                >
                  Send Inquiry
                  <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Admissions;
