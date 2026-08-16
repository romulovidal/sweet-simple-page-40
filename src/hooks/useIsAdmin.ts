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
        // console.log("[AUTH DEBUG] role_check_start, user_id:", user.id);
        
        // Owner bypass (standard admin role check applies to others)
        const isSA = user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
        if (isSA) {
          setIsAdmin(true);
          setIsSuperAdmin(true);
          setRole("super_admin");
          setLoading(false);
          return;
        }

        // Stability timeout for role check
        const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
          setTimeout(() => reject(new Error("Timeout checking roles")), 4000)
        );


        // 1. Direct query attempt (matches AdminPage.tsx pattern)
        const directQueryPromise = (async () => {
          const { data, error } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id);
          return { data, error };
        })();

        const result = await Promise.race([
          directQueryPromise,
          timeoutPromise as any
        ]).catch(err => ({ data: null, error: err }));

        const directData = result.data;
        const directError = result.error;



        if (directError) {
          // console.warn("Direct query failed, trying RPC:", directError);
          
          // 2. RPC fallback
          const { data: hasAdmin, error: rpcError } = await supabase.rpc("check_user_role", {
            _user_id: user.id,
            _role: "admin"
          });
          
          const isSA = user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
          const isA = !!hasAdmin || isSA;
          
          if (cancelled) return;

          // console.log("RPC Result:", { isA, isSA, rpcError });
          
          setIsAdmin(isA);
          setIsSuperAdmin(isSA);
          setRole(isSA ? "super_admin" : (isA ? "admin" : null));
          setLoading(false);
        } else {
          const roles = directData?.map(r => String(r.role)) || [];
          const isSA = roles.includes("super_admin") || user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
          const isA = isSA || roles.includes("admin");

          if (cancelled) return;

          // console.log("Direct query Result:", { roles, isA, isSA });
          
          setIsAdmin(isA);
          setIsSuperAdmin(isSA);
          setRole(isSA ? "super_admin" : (isA ? "admin" : null));
          setLoading(false);
        }
      } catch (err) {
        // console.error("Critical catch block:", err);
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
