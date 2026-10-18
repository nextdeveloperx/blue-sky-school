import { LayoutDashboard } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// M1 will replace this static list with a role-filtered nav driven by the
// signed-in user's role (principal / accountant / teacher).
const navItems = [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard }];

const AdminSidebarNav = () => (
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        {navItems.map(({ label, to, icon: Icon }) => (
          <SidebarMenuItem key={to}>
            <SidebarMenuButton asChild>
              <NavLink to={to} end>
                <Icon />
                <span>{label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
);

export default AdminSidebarNav;
