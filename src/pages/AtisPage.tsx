import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import AdminAtis from "@/components/admin/atis/AdminAtis";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const AtisPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin", { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading || roleLoading || !user) {
    return (
      <div className="min-h-screen bg-[hsl(var(--dark-bg))] flex items-center justify-center px-5">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-3">Validando acesso ao ATIS...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[hsl(var(--dark-bg))] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] p-6 text-center">
          <span className="w-14 h-14 mx-auto rounded-2xl grid place-items-center bg-destructive/10 text-destructive">
            <ShieldAlert className="w-7 h-7" />
          </span>
          <h1 className="text-lg font-bold text-[hsl(var(--dark-text))] mt-4">Acesso restrito</h1>
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-2">
            O painel ATIS está disponível somente para administradores.
          </p>
          <button
            onClick={() => navigate("/admin", { replace: true })}
            className="mt-5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            Voltar ao Admin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))]">
      <header className="sticky top-0 z-40 bg-[hsl(var(--dark-bg))]/95 backdrop-blur border-b border-[hsl(var(--dark-card))]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button
            onClick={() => navigate("/admin")}
            aria-label="Voltar ao painel administrativo"
            className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/15 text-primary shrink-0">
            <MessageCircle className="w-5 h-5" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--dark-muted))]">Painel independente</p>
            <h1 className="text-base font-bold truncate">ATIS WhatsApp</h1>
          </div>

          <button
            onClick={() => navigate("/admin")}
            className="hidden sm:inline-flex h-9 items-center px-4 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] text-xs font-semibold transition-colors"
          >
            Painel Admin
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7 pb-10">
        <AdminAtis />
      </main>
    </div>
  );
};

export default AtisPage;
