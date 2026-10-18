import { LayoutDashboard, GraduationCap, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useSession, type AppRole } from "@/lib/auth/useSession";

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, roles: ["principal", "accountant", "teacher"] },
  { label: "Academic Setup", to: "/admin/academics", icon: GraduationCap, roles: ["principal"] },
  { label: "Students", to: "/admin/students", icon: Users, roles: ["principal", "accountant", "teacher"] },
];

const AdminSidebarNav = () => {
  const { roles } = useSession();

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {navItems
            .filter((item) => item.roles.some((role) => roles.includes(role)))
            .map(({ label, to, icon: Icon }) => (
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
};

export default AdminSidebarNav;
