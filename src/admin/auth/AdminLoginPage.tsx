import { LoginForm } from "@/lib/auth/LoginForm";

const AdminLoginPage = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <LoginForm title="School Management System" redirectTo="/admin" />
  </div>
);

export default AdminLoginPage;
