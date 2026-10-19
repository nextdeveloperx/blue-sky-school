import { Navigate } from "react-router-dom";

// Preserved for backward compatibility with any existing /admin/login
// bookmark or link — the unified login experience now lives at /login.
const AdminLoginPage = () => <Navigate to="/login" replace />;

export default AdminLoginPage;
