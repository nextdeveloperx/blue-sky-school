import { Routes, Route } from "react-router-dom";
import { RequireRole } from "@/lib/auth/RequireRole";
import PortalShell from "./layout/PortalShell";
import PortalDashboardPage from "./features/dashboard/PortalDashboardPage";
import PortalLoginPage from "./auth/PortalLoginPage";
import LinkRequestPage from "./features/children/LinkRequestPage";

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
              <Route path="/link-child" element={<LinkRequestPage />} />
            </Routes>
          </PortalShell>
        </RequireRole>
      }
    />
  </Routes>
);

export default ParentPortalApp;
