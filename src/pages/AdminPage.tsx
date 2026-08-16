import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AdminLogin from "./AdminLogin";
import AdminPanel from "./AdminPanel";
import { Loader2 } from "lucide-react";

const AdminPage = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const resolveAdminAccess = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    setAccessError(null);

    if (!nextSession?.user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      console.log("[ADMIN AUTH] AdminPage starting validation for:", nextSession.user.id);

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", nextSession.user.id);

      if (error) {
        console.warn("[ADMIN AUTH] AdminPage direct query failed, trying RPC:", error);
        
        const { data: hasAdmin, error: rpcError } = await supabase.rpc("has_role", {
          _user_id: nextSession.user.id,
          _role: "admin"
        });
        
        if (rpcError) {
          console.error("[ADMIN AUTH] AdminPage RPC fallback error:", rpcError);
          // Special handling for the owner UUID even if the database is currently restricted
          const isSA = nextSession.user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
          if (isSA) {
            setIsAdmin(true);
            setIsSuperAdmin(true);
            setRole("super_admin");
            setAccessError(null);
          } else {
            setIsAdmin(false);
            setIsSuperAdmin(false);
            setAccessError("Não foi possível validar seu acesso. Erro: " + (rpcError.message || "Acesso negado ao esquema de segurança."));
          }
        } else {
          const isSA = nextSession.user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
          setIsAdmin(!!hasAdmin || isSA);
          setIsSuperAdmin(isSA);
          if (isSA) setRole("super_admin");
          else if (hasAdmin) setRole("admin");
        }
      } else {
        const roles = data?.map(r => String(r.role)) || [];
        const isSA = roles.includes("super_admin") || nextSession.user.id === '5850679f-697b-4ec2-a47c-47b88a96bffa';
        const isA = isSA || roles.includes("admin");

        console.log("[ADMIN AUTH] AdminPage Result:", { roles, isAdmin: isA, isSuperAdmin: isSA });
        
        setIsAdmin(isA);
        setIsSuperAdmin(isSA);
        setRole(isSA ? "super_admin" : (isA ? "admin" : null));
      }
    } catch (err) {
      console.error("[ADMIN AUTH] AdminPage catch block:", err);
      setAccessError("Erro inesperado ao validar acesso.");
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    const syncAccess = (nextSession: Session | null) => {
      if (!active) return;
      void resolveAdminAccess(nextSession);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      syncAccess(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        syncAccess(currentSession);
      })
      .catch((error) => {
        console.error("Erro ao carregar sessão", error);
        if (!active) return;
        setAccessError("Não foi possível carregar a sessão do administrador.");
        setLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [resolveAdminAccess]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-3">Validando acesso do administrador...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AdminLogin />;

  if (accessError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-4">⚠️</p>
          <h2 className="text-lg font-bold mb-2 text-[hsl(var(--dark-text))]">Falha ao validar o acesso</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))]">{accessError}</p>
          <div className="flex items-center justify-center gap-4 mt-5">
            <button
              onClick={() => void resolveAdminAccess(session)}
              className="text-primary text-sm font-semibold"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => void supabase.auth.signOut()}
              className="text-[hsl(var(--dark-muted))] text-sm font-semibold"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h2 className="text-lg font-bold mb-2 text-[hsl(var(--dark-text))]">Acesso negado</h2>
          <p className="text-sm text-[hsl(var(--dark-muted))]">Você não tem permissão de administrador.</p>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="text-primary text-sm font-semibold mt-4"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const searchParams = new URLSearchParams(window.location.search);
  const redirectPath = searchParams.get("redirect");
  
  if (isAdmin && redirectPath === "/atis") {
    navigate("/atis", { replace: true });
    return null;
  }

  return <AdminPanel />;
};

export default AdminPage;
