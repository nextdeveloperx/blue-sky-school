import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserCog,
  Link2,
  ClipboardList,
  Wallet,
  Receipt,
  Banknote,
  CalendarRange,
  PenSquare,
  CheckSquare,
  UserCheck,
  Receipt as ReceiptIcon,
  Download,
  History,
  MessageSquareText,
} from "lucide-react";
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
  { label: "Staff & Roles", to: "/admin/staff", icon: UserCog, roles: ["principal"] },
  { label: "Teacher Assignments", to: "/admin/assignments", icon: Link2, roles: ["principal"] },
  { label: "My Roster", to: "/admin/my-roster", icon: ClipboardList, roles: ["teacher"] },
  { label: "Fees", to: "/admin/fees", icon: Wallet, roles: ["principal", "accountant"] },
  { label: "Payments", to: "/admin/payments", icon: Receipt, roles: ["principal", "accountant"] },
  { label: "Payroll", to: "/admin/payroll", icon: Banknote, roles: ["principal", "accountant"] },
  { label: "Exam Terms", to: "/admin/exam-terms", icon: CalendarRange, roles: ["principal"] },
  { label: "Marks Entry", to: "/admin/marks", icon: PenSquare, roles: ["teacher"] },
  { label: "Results Review", to: "/admin/results", icon: CheckSquare, roles: ["principal"] },
  { label: "Parent Requests", to: "/admin/parent-requests", icon: UserCheck, roles: ["principal", "accountant"] },
  { label: "Admission Enquiries", to: "/admin/enquiries", icon: MessageSquareText, roles: ["principal", "accountant"] },
  { label: "Expenses", to: "/admin/expenses", icon: ReceiptIcon, roles: ["principal", "accountant"] },
  { label: "Exports", to: "/admin/exports", icon: Download, roles: ["principal", "accountant"] },
  { label: "Audit Log", to: "/admin/audit-log", icon: History, roles: ["principal"] },
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
