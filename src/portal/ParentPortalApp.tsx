import { Routes, Route } from "react-router-dom";
import { RequireRole } from "@/lib/auth/RequireRole";
import PortalShell from "./layout/PortalShell";
import PortalDashboardPage from "./features/dashboard/PortalDashboardPage";
import PortalLoginPage from "./auth/PortalLoginPage";

const ParentPortalApp = () => (
  <Routes>
    <Route path="/login" element={<PortalLoginPage />} />
    <Route
      path="/*"
      element={
        <RequireRole roles={["parent"]} loginPath="/portal/login">
          <PortalShell>
            <Routes>
              <Route path="/" element={<PortalDashboardPage />} />
            </Routes>
          </PortalShell>
        </RequireRole>
      }
    />
  </Routes>
);

export default ParentPortalApp;
