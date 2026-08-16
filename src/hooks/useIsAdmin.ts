import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setRole(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const commit = (admin: boolean, superAdmin: boolean) => {
      if (cancelled) return;
      setIsAdmin(admin || superAdmin);
      setIsSuperAdmin(superAdmin);
      setRole(superAdmin ? "super_admin" : admin ? "admin" : null);
      setLoading(false);
    };

    const checkAdmin = async () => {
      setLoading(true);
      try {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout checking roles")), 4000),
        );

        const directQuery = supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        const { data, error } = await Promise.race([directQuery, timeoutPromise]);

        if (!error) {
          const roles = data?.map((row) => String(row.role)) ?? [];
          commit(roles.includes("admin"), roles.includes("super_admin"));
          return;
        }

        // Database-backed fallback. The generated client types can lag behind
        // migrations, so only this fallback uses the untyped client surface.
        const rpc = (supabase as any).rpc.bind(supabase);
        const [{ data: hasAdmin, error: adminError }, { data: hasSuperAdmin, error: superError }] = await Promise.all([
          rpc("has_role", { _user_id: user.id, _role: "admin" }),
          rpc("is_super_admin", { _user_id: user.id }),
        ]);

        if (adminError || superError) throw adminError ?? superError;
        commit(Boolean(hasAdmin), Boolean(hasSuperAdmin));
      } catch {
        commit(false, false);
      }
    };

    void checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, isSuperAdmin, role, loading };
}
