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
        
        // 1. Direct table check (more reliable if RLS allows)
        const { data: roles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        
        if (!rolesError && roles && roles.length > 0) {
          const roleList = roles.map(r => r.role);
          const hasAdmin = roleList.includes('admin') || roleList.includes('super_admin');
          const hasSA = roleList.includes('super_admin') || user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
          
          if (!cancelled) {
            setIsSuperAdmin(hasSA);
            setIsAdmin(hasAdmin);
            setRole(hasSA ? "super_admin" : (hasAdmin ? "admin" : null));
            setLoading(false);
          }
          return;
        }

        // 2. Fallback to RPC if table check fails or returns empty
        const { data: roleResult, error } = await supabase.rpc('check_user_role', {
          _user_id: user.id,
          _role: 'admin'
        });

        const { data: isSA_Result } = await supabase.rpc('check_user_role', {
          _user_id: user.id,
          _role: 'super_admin'
        });

        if (cancelled) return;

        if (error) {
          console.error("[ADMIN AUTH] RPC Error:", error);
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
