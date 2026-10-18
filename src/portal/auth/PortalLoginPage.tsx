import { LoginForm } from "@/lib/auth/LoginForm";

const PortalLoginPage = () => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-background">
    <LoginForm title="Parent Portal" redirectTo="/portal" signupSource="portal" />
  </div>
);

export default PortalLoginPage;
