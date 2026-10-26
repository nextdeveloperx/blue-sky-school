import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, LogIn, LogOut, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/blue-sky-school-logo.png";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { useSession } from "@/lib/auth/useSession";
import { resolveRoleRedirect } from "@/lib/auth/resolveRoleRedirect";
import { getSupabaseClient } from "@/lib/supabase/client";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "About Us", path: "/about" },
  { name: "Academics", path: "/academics" },
  { name: "Admissions", path: "/admissions" },
  { name: "Gallery", path: "/gallery" },
  { name: "Contact", path: "/contact" },
];

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { session, roles, loading } = useSession();
  const dashboardPath = resolveRoleRedirect(roles);

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    // No manual navigation needed: onAuthStateChange (inside useSession)
    // flips session to null and this component re-renders to the
    // logged-out nav state immediately.
  }

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-md"
          : "bg-transparent"
      }`}
    >
      <nav className="section-container">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={logo}
              alt="Blue Sky School crest"
              className="w-10 h-10 md:w-12 md:h-12 object-contain transition-transform group-hover:scale-110"
            />
            <div className="flex flex-col">
              <span className="font-heading font-bold text-lg text-foreground leading-tight">
                Blue Sky
              </span>
              <span className="text-xs text-primary font-medium -mt-0.5">
                School
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 ${
                  location.pathname === link.path
                    ? "text-primary bg-primary/10"
                    : "text-foreground/80 hover:text-primary hover:bg-primary/5"
                }`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Login/Dashboard + CTA - Desktop */}
          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle />
            {!loading && (
              <>
                {session ? (
                  <>
                    {dashboardPath && (
                      <Link
                        to={dashboardPath}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                        <span className="hidden xl:inline">Dashboard</span>
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="hidden xl:inline">Logout</span>
                    </button>
                  </>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <LogIn className="w-4 h-4" />
                    <span className="hidden xl:inline">Login</span>
                  </Link>
                )}
              </>
            )}
            <Link to="/admissions" className="btn-accent text-sm">
              Admissions Open
            </Link>
          </div>

          {/* Mobile: theme toggle + menu button */}
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggle />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-foreground hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-background border-t border-border"
          >
            <div className="section-container py-4 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                    location.pathname === link.path
                      ? "text-primary bg-primary/10"
                      : "text-foreground/80 hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-2 border-t border-border">
                {!loading && (
                  <>
                    {session ? (
                      <>
                        {dashboardPath && (
                          <Link
                            to={dashboardPath}
                            className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <LayoutDashboard className="w-4 h-4" />
                            Dashboard
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors w-full text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          Logout
                        </button>
                      </>
                    ) : (
                      <Link
                        to="/login"
                        className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium text-foreground/80 hover:text-primary hover:bg-primary/5 transition-colors"
                      >
                        <LogIn className="w-4 h-4" />
                        Login
                      </Link>
                    )}
                  </>
                )}
              </div>
              <Link
                to="/admissions"
                className="btn-accent w-full text-center mt-4"
              >
                Admissions Open
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
