import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

export type AppRole = "principal" | "accountant" | "teacher" | "parent";

interface SessionState {
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
}

/**
 * Shared by both the admin app and the parent portal. Tracks the Supabase
 * Auth session and resolves the signed-in user's roles from `user_roles`
 * (RLS-scoped to the caller's own rows, or all rows for a principal).
 * This is a UX convenience for routing/nav only — every actual data access
 * is still enforced server-side by RLS regardless of what this reports.
 */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    let isMounted = true;

    async function loadRoles(userId: string) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (isMounted) {
        setRoles((data ?? []).map((row) => row.role as AppRole));
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      if (data.session) {
        loadRoles(data.session.user.id).finally(() => isMounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      if (nextSession) {
        setLoading(true);
        loadRoles(nextSession.user.id).finally(() => isMounted && setLoading(false));
      } else {
        setRoles([]);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, roles, loading };
}
