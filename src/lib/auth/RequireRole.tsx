import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSession, type AppRole } from "./useSession";

interface RequireRoleProps {
  roles: AppRole[];
  loginPath: string;
  children: ReactNode;
}

/**
 * Client-side route gate — a UX convenience (redirect to login, show a 403)
 * so unauthenticated/wrong-role users don't see a flash of private UI.
 * This is NOT the security boundary: every table has RLS enforcing the same
 * (and finer-grained) rules server-side regardless of what this component
 * decides to render.
 */
export function RequireRole({ roles, loginPath, children }: RequireRoleProps) {
  const { session, roles: userRoles, loading } = useSession();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to={loginPath} replace />;
  }

  const hasRequiredRole = roles.some((role) => userRoles.includes(role));
  if (!hasRequiredRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-center p-6">
        <h1 className="font-heading font-bold text-xl text-foreground">Access denied</h1>
        <p className="text-muted-foreground max-w-sm">
          Your account does not have permission to view this area.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
