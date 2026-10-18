import { Routes, Route } from "react-router-dom";
import PortalShell from "./layout/PortalShell";
import PortalDashboardPage from "./features/dashboard/PortalDashboardPage";

// Auth (parent signup/login), link-request flow, and verified-child data
// views land in M8. For now every /portal/* path renders the shell so the
// lazy-loaded chunk boundary and layout can be verified end-to-end.
const ParentPortalApp = () => (
  <PortalShell>
    <Routes>
      <Route path="/" element={<PortalDashboardPage />} />
    </Routes>
  </PortalShell>
);

export default ParentPortalApp;
