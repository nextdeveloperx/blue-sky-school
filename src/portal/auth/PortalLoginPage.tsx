import { Navigate } from "react-router-dom";

// Preserved for backward compatibility with any existing /portal/login
// bookmark or link — the unified login experience now lives at /login.
const PortalLoginPage = () => <Navigate to="/login" replace />;

export default PortalLoginPage;
