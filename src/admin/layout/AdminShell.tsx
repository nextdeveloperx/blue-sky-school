import { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import AdminSidebarNav from "./AdminSidebarNav";

const AdminShell = ({ children }: { children: ReactNode }) => (
  <SidebarProvider>
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-heading font-semibold text-sm">Blue Sky Admin</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <AdminSidebarNav />
      </SidebarContent>
    </Sidebar>
    <SidebarInset>
      <header className="flex items-center gap-2 border-b border-border px-4 h-14">
        <SidebarTrigger />
        <span className="font-heading font-semibold text-sm text-foreground">
          School Management System
        </span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </SidebarInset>
  </SidebarProvider>
);

export default AdminShell;
