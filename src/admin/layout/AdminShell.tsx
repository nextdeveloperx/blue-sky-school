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
          {/* Absolute URL to the public marketing site, not an admin route —
              a plain <a> (not react-router's Link, which is for in-app
              routes) so this correctly leaves the admin app entirely. */}
          <a
            href="https://blue-sky-school.vercel.app/"
            aria-label="Blue Sky School public website home"
            className="flex items-center gap-2 px-2 py-1 overflow-hidden rounded-md hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img src={logo} alt="Blue Sky School crest" className="w-8 h-8 object-contain shrink-0" />
            <span className="font-heading font-semibold text-sm truncate group-data-[collapsible=icon]:hidden">
              Blue Sky
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <AdminSidebarNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="bg-[hsl(var(--admin-background))]">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 h-14 shadow-sm">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="font-heading font-semibold text-sm text-foreground">
              School Management System
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminShell;
