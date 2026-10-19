import { Link } from "react-router-dom";
import { LoginForm } from "@/lib/auth/LoginForm";

const LoginPage = () => (
  <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
    <LoginForm />
    <p className="text-sm text-muted-foreground text-center">
      New parent?{" "}
      <Link to="/register" className="text-primary hover:underline font-medium">
        Create an account
      </Link>
    </p>
  </div>
);

export default LoginPage;
