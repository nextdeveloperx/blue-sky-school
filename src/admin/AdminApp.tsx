import { Routes, Route } from "react-router-dom";
import { RequireRole } from "@/lib/auth/RequireRole";
import AdminShell from "./layout/AdminShell";
import DashboardPage from "./features/dashboard/DashboardPage";
import AdminLoginPage from "./auth/AdminLoginPage";
import AcademicSetupPage from "./features/academics/AcademicSetupPage";
import StudentsPage from "./features/students/StudentsPage";
import StaffPage from "./features/staff/StaffPage";
import TeacherAssignmentsPage from "./features/assignments/TeacherAssignmentsPage";
import MyRosterPage from "./features/roster/MyRosterPage";
import FeesPage from "./features/fees/FeesPage";
import PaymentsPage from "./features/fees/PaymentsPage";
import PayrollPage from "./features/payroll/PayrollPage";

const AdminApp = () => (
  <Routes>
    <Route path="/login" element={<AdminLoginPage />} />
    <Route
      path="/*"
      element={
        <RequireRole roles={["principal", "accountant", "teacher"]} loginPath="/admin/login">
          <AdminShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/academics" element={<AcademicSetupPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/assignments" element={<TeacherAssignmentsPage />} />
              <Route path="/my-roster" element={<MyRosterPage />} />
              <Route path="/fees" element={<FeesPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payroll" element={<PayrollPage />} />
            </Routes>
          </AdminShell>
        </RequireRole>
      }
    />
  </Routes>
);

export default AdminApp;
