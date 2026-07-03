import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setIsAdmin(false); setLoading(false); }
        return;
      }
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!cancelled) { setIsAdmin(!!data); setLoading(false); }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return { isAdmin, loading };
}