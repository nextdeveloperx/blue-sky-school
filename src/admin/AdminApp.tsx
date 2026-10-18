import { Routes, Route } from "react-router-dom";
import { RequireRole } from "@/lib/auth/RequireRole";
import AdminShell from "./layout/AdminShell";
import DashboardPage from "./features/dashboard/DashboardPage";
import AdminLoginPage from "./auth/AdminLoginPage";
import AcademicSetupPage from "./features/academics/AcademicSetupPage";
import StudentsPage from "./features/students/StudentsPage";

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
            </Routes>
          </AdminShell>
        </RequireRole>
      }
    />
  </Routes>
);

export default AdminApp;
