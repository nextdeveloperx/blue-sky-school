import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase/client";
import logo from "@/assets/blue-sky-school-logo.jpg";

const PortalShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border h-14 flex items-center justify-between px-4">
        <Link to="/portal" className="flex items-center gap-2">
          <img src={logo} alt="Blue Sky School crest" className="w-8 h-8 object-contain shrink-0" />
          <span className="font-heading font-semibold text-sm">Blue Sky Family Dashboard</span>
        </Link>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </header>
      <main className="flex-1 p-6 max-w-3xl w-full mx-auto">{children}</main>
    </div>
  );
};

export default PortalShell;
