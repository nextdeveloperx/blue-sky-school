import { Routes, Route } from "react-router-dom";
import { RequireRole } from "@/lib/auth/RequireRole";
import AdminShell from "./layout/AdminShell";
import DashboardPage from "./features/dashboard/DashboardPage";
import AdminLoginPage from "./auth/AdminLoginPage";

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
            </Routes>
          </AdminShell>
        </RequireRole>
      }
    />
  </Routes>
);

export default AdminApp;
