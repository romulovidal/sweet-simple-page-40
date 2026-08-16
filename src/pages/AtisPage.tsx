import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AtisLayout from "@/components/atis/AtisLayout";

const AtisPage = () => {
  const { isAdmin, isSuperAdmin, role, loading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log("[ATIS_ACCESS] user_present:", !!data.session?.user);
      if (data.session?.user) {
        console.log("[ATIS_ACCESS] user_id:", data.session.user.id);
      }
      setSession(data.session);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    // Only redirect if auth check is finished and NO session exists
    if (authChecked && !session) {
      console.log("[ATIS_ACCESS] No session, redirecting to /admin");
      navigate("/admin");
    }
  }, [authChecked, session, navigate]);

  // Combined loading state
  const isInitializing = roleLoading || !authChecked;

  useEffect(() => {
    if (!isInitializing && session) {
      console.log("[ATIS_ACCESS] access_granted:", isAdmin);
      console.log("[ATIS_ACCESS] resolved_role:", role);
      console.log("[ATIS_ACCESS] is_super_admin:", isSuperAdmin);
    }
  }, [isInitializing, session, isAdmin, role, isSuperAdmin]);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--dark-bg))]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-xs text-[hsl(var(--dark-muted))] mt-2 font-mono">[ATIS_ACCESS] loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5 bg-[hsl(var(--dark-bg))]">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold text-[hsl(var(--dark-text))]">Acesso negado</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">Painel Atis é restrito a administradores.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button onClick={() => navigate("/admin")} className="text-primary text-sm font-semibold hover:underline">Ir para Admin</button>
            <p className="text-[10px] text-[hsl(var(--dark-muted))] font-mono opacity-50 mt-4">
              UID: {session.user.id.substring(0, 8)}... | Role: {role || 'none'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <AtisLayout />;
};

export default AtisPage;