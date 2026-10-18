import { Routes, Route } from "react-router-dom";
import AdminShell from "./layout/AdminShell";
import DashboardPage from "./features/dashboard/DashboardPage";

// Auth gating (AdminGuard) and role-based routing land in M1. For now every
// /admin/* path renders the shell so the lazy-loaded chunk boundary and
// layout can be verified end-to-end before auth exists.
const AdminApp = () => (
  <AdminShell>
    <Routes>
      <Route path="/" element={<DashboardPage />} />
    </Routes>
  </AdminShell>
);

export default AdminApp;
