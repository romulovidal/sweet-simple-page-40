import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Cake,
  ContactRound,
  History,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  ShieldAlert,
  Smartphone,
  Settings2,
  WandSparkles,
  X,
} from "lucide-react";
import AdminAtis from "@/components/admin/atis/AdminAtis";
import AtisRecipients from "@/components/admin/atis/AtisRecipients";
import AtisBirthdays from "@/components/admin/atis/AtisBirthdays";
import AtisSettings from "@/components/admin/atis/AtisSettings";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const AtisPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const [moreOpen, setMoreOpen] = useState(false);

  const recipients = location.pathname.startsWith("/atis/destinatarios");
  const birthdays = location.pathname.startsWith("/atis/aniversariantes");
  const connection = location.pathname.startsWith("/atis/conexao");
  const settings = location.pathname.startsWith("/atis/configuracoes");
  const dashboard = location.pathname === "/atis";

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/admin", { replace: true });
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
          <span className="w-14 h-14 mx-auto rounded-2xl grid place-items-center bg-destructive/10 text-destructive"><ShieldAlert className="w-7 h-7" /></span>
          <h1 className="text-lg font-bold text-[hsl(var(--dark-text))] mt-4">Acesso restrito</h1>
          <p className="text-sm text-[hsl(var(--dark-muted))] mt-2">O painel ATIS está disponível somente para administradores.</p>
          <button onClick={() => navigate("/admin", { replace: true })} className="mt-5 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Voltar ao Admin</button>
        </div>
      </div>
    );
  }

  const navButton = (active: boolean) => active
    ? "text-primary"
    : "text-[hsl(var(--dark-muted))]";

  return (
    <div className="min-h-screen bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-text))]">
      <header className="sticky top-0 z-40 bg-[hsl(var(--dark-bg))]/95 backdrop-blur-xl border-b border-[hsl(var(--dark-card))]">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-15 min-h-[60px] flex items-center gap-3">
          <button onClick={() => navigate("/admin")} aria-label="Voltar ao painel administrativo" className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] active:scale-95 hover:bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] transition shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="w-10 h-10 rounded-2xl grid place-items-center bg-primary/15 text-primary shrink-0"><MessageCircle className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] uppercase tracking-[0.18em] text-[hsl(var(--dark-muted))]">Painel independente</p>
            <h1 className="text-sm sm:text-base font-bold truncate">ATIS WhatsApp</h1>
          </div>
          <button onClick={() => navigate("/admin")} className="hidden md:inline-flex h-9 items-center px-4 rounded-xl bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] text-xs font-semibold transition-colors">Painel Admin</button>
        </div>

        <div className="hidden md:flex max-w-5xl mx-auto px-6 pb-3 gap-2 overflow-x-auto">
          <button onClick={() => navigate("/atis")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${dashboard ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><LayoutDashboard className="w-4 h-4" /> Painel</button>
          <button onClick={() => navigate("/atis/destinatarios")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${recipients ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><ContactRound className="w-4 h-4" /> Destinatários</button>
          <button onClick={() => navigate("/atis/aniversariantes")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${birthdays ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><Cake className="w-4 h-4" /> Aniversariantes</button>
          <button onClick={() => navigate("/atis/conexao")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${connection ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><Smartphone className="w-4 h-4" /> Conexão</button>
          <button onClick={() => navigate("/atis/configuracoes")} className={`h-9 px-4 rounded-xl shrink-0 text-xs font-bold flex items-center gap-2 ${settings ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"}`}><Settings2 className="w-4 h-4" /> Configurações</button>
          <span className="h-9 px-4 rounded-xl shrink-0 grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/50">Enviar</span>
          <span className="h-9 px-4 rounded-xl shrink-0 grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/50">Automações</span>
          <span className="h-9 px-4 rounded-xl shrink-0 grid place-items-center text-xs font-semibold bg-[hsl(var(--dark-card))]/60 text-[hsl(var(--dark-muted))]/50">Histórico</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-7 pb-[calc(6.5rem+env(safe-area-inset-bottom))] md:pb-10">
        {recipients ? <AtisRecipients /> : birthdays ? <AtisBirthdays /> : settings ? <AtisSettings /> : connection ? <AdminAtis initialView="connection" /> : <AdminAtis initialView="overview" />}
      </main>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-[55] bg-black/55 backdrop-blur-[2px]" onClick={() => setMoreOpen(false)}>
          <div className="absolute left-3 right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] rounded-3xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] shadow-2xl p-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-2 py-1.5">
              <div><p className="text-[10px] uppercase tracking-[0.18em] text-primary">ATIS</p><p className="text-sm font-bold mt-0.5">Mais opções</p></div>
              <button onClick={() => setMoreOpen(false)} className="w-9 h-9 rounded-xl grid place-items-center bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))]"><X className="w-4 h-4" /></button>
            </div>
            <button onClick={() => navigate("/atis/configuracoes")} className={`w-full mt-2 rounded-2xl p-3 flex items-center gap-3 text-left ${settings ? "bg-primary/15 border border-primary/20" : "bg-[hsl(var(--dark-bg))]"}`}><span className="w-10 h-10 rounded-xl grid place-items-center bg-primary/15 text-primary"><Settings2 className="w-5 h-5" /></span><div><p className="text-xs font-bold">Configurações do ATIS</p><p className="text-[10px] text-[hsl(var(--dark-muted))] mt-0.5">Editar prompt e comportamento do assistente</p></div></button>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {[
                ["Enviar", Send, "Em breve"],
                ["Automações", WandSparkles, "Em breve"],
                ["Histórico", History, "Em breve"],
              ].map(([label, Icon, status]: any) => (
                <div key={label} className="rounded-2xl bg-[hsl(var(--dark-bg))] p-3 min-h-[92px] flex flex-col items-center justify-center text-center opacity-55">
                  <Icon className="w-5 h-5 text-primary" />
                  <p className="text-[11px] font-bold mt-2">{label}</p>
                  <p className="text-[9px] text-[hsl(var(--dark-muted))] mt-0.5">{status}</p>
                </div>
              ))}
            </div>
            <button onClick={() => navigate("/admin")} className="w-full h-11 mt-3 rounded-2xl bg-[hsl(var(--dark-bg))] text-xs font-semibold">Abrir Painel Admin</button>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-[60] bg-[hsl(var(--dark-card))]/96 backdrop-blur-xl border-t border-[hsl(var(--dark-card-hover))] pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
          <button onClick={() => navigate("/atis")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(dashboard)}`} aria-current={dashboard ? "page" : undefined}><LayoutDashboard className="w-5 h-5" /><span className="text-[9px] font-bold">Painel</span></button>
          <button onClick={() => navigate("/atis/destinatarios")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(recipients)}`} aria-current={recipients ? "page" : undefined}><ContactRound className="w-5 h-5" /><span className="text-[9px] font-bold">Destinos</span></button>
          <button onClick={() => navigate("/atis/aniversariantes")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(birthdays)}`} aria-current={birthdays ? "page" : undefined}><Cake className="w-5 h-5" /><span className="text-[9px] font-bold">Anivers.</span></button>
          <button onClick={() => navigate("/atis/conexao")} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${navButton(connection)}`} aria-current={connection ? "page" : undefined}><Smartphone className="w-5 h-5" /><span className="text-[9px] font-bold">Conexão</span></button>
          <button onClick={() => setMoreOpen((value) => !value)} className={`flex flex-col items-center justify-center gap-1 active:scale-95 transition ${moreOpen || settings ? "text-primary" : "text-[hsl(var(--dark-muted))]"}`} aria-expanded={moreOpen}><MoreHorizontal className="w-5 h-5" /><span className="text-[9px] font-bold">Mais</span></button>
        </div>
      </nav>
    </div>
  );
};

export default AtisPage;
