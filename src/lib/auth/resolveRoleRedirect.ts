import type { AppRole } from "./useSession";

/**
 * Single source of truth for "which dashboard does this role set land on" —
 * used by the unified login page right after authentication. Never trusts
 * anything about the account except the role rows actually read back from
 * `user_roles` (RLS-scoped to the caller's own rows), so there is nothing
 * here for a client to spoof.
 */
export function resolveRoleRedirect(roles: AppRole[]): string | null {
  if (roles.includes("principal") || roles.includes("accountant") || roles.includes("teacher")) {
    return "/admin";
  }
  if (roles.includes("parent")) {
    return "/portal";
  }
  return null;
}
