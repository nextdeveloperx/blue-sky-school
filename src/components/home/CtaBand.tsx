import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CURRENT_ADMISSION_SESSION } from "@/lib/content/admissions";

const CtaBand = () => {
  return (
    <section className="section-padding bg-secondary text-secondary-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: "var(--hero-gradient)" }}
        aria-hidden="true"
      />
      <div className="section-container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left"
        >
          <div>
            <h2 className="font-heading font-bold text-2xl md:text-3xl mb-2">
              Ready to join the Blue Sky family?
            </h2>
            <p className="text-secondary-foreground/80 max-w-xl">
              Admissions are open for {CURRENT_ADMISSION_SESSION}. Reach out and we'll guide
              you through every step, from enquiry to enrollment.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <Link to="/admissions" className="btn-accent group">
              Apply for Admission
              <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-lg border-2 border-secondary-foreground/30 text-secondary-foreground font-semibold px-6 py-3 transition-all duration-300 hover:bg-secondary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Contact Us
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaBand;
