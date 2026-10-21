import { Link } from "react-router-dom";
import { LoginForm } from "@/lib/auth/LoginForm";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";

const LoginPage = () => (
  <div className="relative min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-background">
    <ThemeToggle className="absolute top-4 right-4" />
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
