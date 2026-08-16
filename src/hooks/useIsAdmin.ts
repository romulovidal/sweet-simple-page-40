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
        console.log("[ADMIN AUTH] useIsAdmin validating roles for:", user.id);
        
        // Use a simpler query first to check if the table is even accessible
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        if (rolesError) {
          console.warn("[ADMIN AUTH] user_roles table query failed:", rolesError);
        }

        const { data: roleResult, error } = await supabase.rpc('check_user_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        // Também precisamos saber se é super_admin para a UI
        const { data: isSA_Result } = await supabase.rpc('check_user_role', {
          _user_id: user.id,
          _role: 'super_admin'
        });

        if (cancelled) return;

        if (error) {
          console.error("[ADMIN AUTH] Error fetching roles:", error);
          
          // Secondary fallback using hardcoded super admin UUID
          const isSA = user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
          
          if (!cancelled) {
            setIsSuperAdmin(isSA);
            setIsAdmin(isSA);
            setRole(isSA ? "super_admin" : null);
            setLoading(false);
          }
          return;
        }

        const isA = !!roleResult;
        const isSA = !!isSA_Result || user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';

        console.log("[ADMIN AUTH] Result:", { 
          userId: user.id, 
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
