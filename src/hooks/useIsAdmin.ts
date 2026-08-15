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

    const checkAdmin = async () => {
      try {
        console.log("[ADMIN AUTH] Validating roles for:", user.id);
        
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);

        if (cancelled) return;

        if (error) {
          console.error("[ADMIN AUTH] Error fetching roles:", error);
          const { data: hasAdmin } = await supabase.rpc("has_role", {
            _user_id: user.id,
            _role: "admin"
          });
          
          if (!cancelled) {
            const isSA = user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
            setIsAdmin(!!hasAdmin || isSA);
            setIsSuperAdmin(isSA);
            setLoading(false);
          }
          return;
        }

        // We cast role to string to avoid TS errors with the generated enum which doesn't know about super_admin yet
        const roles = data?.map(r => String(r.role)) || [];
        const isSA = roles.includes("super_admin") || user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
        const isA = isSA || roles.includes("admin");

        console.log("[ADMIN AUTH] Result:", { 
          userId: user.id, 
          roles, 
          isAdmin: isA, 
          isSuperAdmin: isSA 
        });

        setIsSuperAdmin(isSA);
        setIsAdmin(isA);
        setRole(isSA ? "super_admin" : (isA ? "admin" : null));
        setLoading(false);
      } catch (err) {
        console.error("[ADMIN AUTH] Catch block:", err);
        if (!cancelled) setLoading(false);
      }
    };

    checkAdmin();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return { isAdmin, isSuperAdmin, role, loading };
}
