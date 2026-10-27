import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import logo from "@/assets/blue-sky-school-logo.png";

const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground">
      <div className="section-container py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <img src={logo} alt="Blue Sky School crest" className="w-10 h-10 object-contain" />
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg leading-tight">
                  Blue Sky
                </span>
                <span className="text-xs text-accent font-medium -mt-0.5">
                  School
                </span>
              </div>
            </Link>
            <p className="text-sm text-secondary-foreground/80">
              Education is the Only Solution
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[
                { name: "About Us", path: "/about" },
                { name: "Academics", path: "/academics" },
                { name: "Admissions", path: "/admissions" },
                { name: "Gallery", path: "/gallery" },
                { name: "Contact", path: "/contact" },
              ].map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-sm text-secondary-foreground/80 hover:text-accent transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-secondary-foreground/80">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <a href="mailto:blueskyschool0@gmail.com" className="hover:text-accent transition-colors">
                  blueskyschool0@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-secondary-foreground/80">
                <Phone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>+91 XXXXX XXXXX</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-secondary-foreground/80">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>School Address, City, India</span>
              </li>
            </ul>
          </div>

          {/* Hours */}
          <div>
            <h4 className="font-heading font-semibold text-lg mb-4">School Hours</h4>
            <ul className="space-y-2 text-sm text-secondary-foreground/80">
              <li>Monday - Friday</li>
              <li className="font-medium text-secondary-foreground">8:00 AM - 3:00 PM</li>
              <li className="mt-4">Saturday</li>
              <li className="font-medium text-secondary-foreground">8:00 AM - 12:00 PM</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-secondary-foreground/20 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center text-sm text-secondary-foreground/60">
          <p>© {new Date().getFullYear()} Blue Sky School. All rights reserved.</p>
          <span className="hidden sm:inline">·</span>
          <Link to="/privacy" className="hover:text-accent transition-colors">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline">·</span>
          <Link to="/terms" className="hover:text-accent transition-colors">
            Terms &amp; Conditions
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
