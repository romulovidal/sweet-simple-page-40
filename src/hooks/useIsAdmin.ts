import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useIsAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    let cancelled = false;

    const checkAdmin = async () => {
      try {
        // Try direct query first (more reliable for PostgREST cache)
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (!cancelled) {
          if (data) {
            console.log("[AUTH DEBUG] useIsAdmin direct match:", data);
            setIsAdmin(true);
            setLoading(false);
            return;
          }

          if (error) {
            console.error("[AUTH DEBUG] useIsAdmin direct error:", error);
          }

          // Fallback to RPC
          const { data: rpcData, error: rpcError } = await supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin"
          });

          if (!cancelled) {
            if (rpcError) {
              console.error("[AUTH DEBUG] useIsAdmin RPC error:", rpcError);
            }
            console.log("[AUTH DEBUG] useIsAdmin RPC result:", rpcData);
            setIsAdmin(!!rpcData);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("[AUTH DEBUG] useIsAdmin catch block:", err);
        if (!cancelled) setLoading(false);
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, loading };
}
