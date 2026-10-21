import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/blue-sky-school-logo.png";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import AdminSidebarNav from "./AdminSidebarNav";

const AdminShell = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1">
            <img src={logo} alt="Blue Sky School crest" className="w-8 h-8 object-contain shrink-0" />
            <span className="font-heading font-semibold text-sm">Blue Sky Admin</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AdminSidebarNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 h-14">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="font-heading font-semibold text-sm text-foreground">
              School Management System
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminShell;
