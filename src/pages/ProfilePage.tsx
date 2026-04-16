import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookmarkCheck, BookOpenText, ChevronRight, Clock3, Compass,
  Flame, RotateCcw, Settings, Trash2, Sparkles, LogOut, Loader2, Mail, Shield, Download, Bell, BellOff,
} from "lucide-react";
import { toast } from "sonner";
import BibleDownloadManager from "@/components/BibleDownloadManager";
import { registerPushNotifications, isPushEnabled, unregisterPush } from "@/lib/pushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorage, type ReadingProgress, type SavedVerse, type StreakData, type DailyVerseEntry, getDisplayStreak } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import LGPDTermsDialog from "@/components/LGPDTermsDialog";

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

type ProfileView = "overview" | "saved" | "history" | "verse-history" | "settings" | "auth";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const [savedVerses, setSavedVerses] = useLocalStorage<SavedVerse[]>("saved-verses", []);
  const [streak, setStreak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });
  const [progress, setProgress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);
  const [planProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);
  const [verseHistory] = useLocalStorage<DailyVerseEntry[]>("daily-verse-history", []);
  const [view, setView] = useState<ProfileView>("overview");

  // Auth state
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    isPushEnabled().then(setPushEnabled);
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  const togglePush = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unregisterPush();
        setPushEnabled(false);
        toast.success("Notificações desativadas");
      } else {
        const ok = await registerPushNotifications();
        setPushEnabled(ok);
        if (ok) toast.success("Notificações ativadas! 🔔");
        else toast.error("Não foi possível ativar notificações");
      }
    } catch {
      toast.error("Erro ao alterar notificações");
    }
    setPushLoading(false);
  };

  const activePlansCount = useMemo(
    () => planProgress.filter((plan) => plan.completedDays.length > 0).length,
    [planProgress]
  );

  const readingHistory = useMemo(
    () => [...new Set(streak.history)].sort((first, second) => second.localeCompare(first)),
    [streak.history]
  );

  const recentSavedVerses = useMemo(
    () => [...savedVerses].sort((first, second) => second.savedAt.localeCompare(first.savedAt)).slice(0, 3),
    [savedVerses]
  );

  const formatDate = (value: string) =>
    new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", year: "numeric",
    });

  const handleContinueReading = () => {
    if (progress) {
      navigate(`/biblia?book=${progress.bookAbbrev}&chapter=${progress.chapter}`, { state: { reset: Date.now() } });
      return;
    }
    navigate(`/biblia?book=gn&chapter=1`, { state: { reset: Date.now() } });
  };

  const clearSavedVerses = () => {
    if (savedVerses.length === 0) { toast("Você ainda não salvou nenhum versículo."); return; }
    if (!window.confirm("Deseja apagar todos os versículos salvos?")) return;
    setSavedVerses([]);
    toast.success("Versículos salvos removidos.");
  };

  const resetReadingData = () => {
    if (!window.confirm("Deseja reiniciar seu progresso de leitura e sequência?")) return;
    setProgress(null);
    setStreak({ current: 0, lastDate: "", history: [] });
    toast.success("Seu progresso foi reiniciado.");
  };

  // Auth handlers
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === "signup" && !lgpdAccepted) {
      toast.error("Você precisa aceitar os Termos de Privacidade para continuar.");
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
      }
      setView("overview");
    } catch (err: any) {
      toast.error(err.message || "Erro na autenticação");
    } finally {
      setAuthSubmitting(false);
    }
  };

      {isAdmin && (
        <div className="px-5 mb-6">
          <button onClick={() => navigate("/admin")}
            className="w-full bg-amber-600 text-white rounded-2xl p-4 text-left active:opacity-90 transition-opacity flex items-center gap-3">
            <Shield className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">Ir para área admin</p>
              <p className="text-xs opacity-90 mt-1">Gerenciar avisos, planos, cultos e mais</p>
            </div>
            <ChevronRight className="w-5 h-5 ml-auto" />
          </button>
        </div>
      )}

  const handleSignOut = async () => {
    await signOut();
    toast.success("Você saiu da conta.");
    setView("overview");
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="pb-20 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Auth view (login/signup)
  if (!user || view === "auth") {
    if (!user) {
      return (
        <div className="pb-20 min-h-screen">
          <header className="px-5 pt-12 pb-6 text-center">
            <img src="/logo.png" alt="Logo" className="w-20 h-20 mx-auto mb-4 rounded-2xl" />
            <h1 className="text-2xl font-bold">A Bíblia do Atalaia</h1>
            <p className="text-sm text-[hsl(var(--dark-muted))] mt-1">Entre para salvar seu progresso</p>
          </header>

          <div className="px-5 space-y-4">
            {/* LGPD Consent - only for signup */}
            {authMode === "signup" && (
              <div className="flex items-start gap-3 bg-[hsl(var(--dark-card))] rounded-2xl p-4">
                <Checkbox
                  id="lgpd"
                  checked={lgpdAccepted}
                  onCheckedChange={(checked) => setLgpdAccepted(checked === true)}
                  className="mt-0.5"
                />
                <label htmlFor="lgpd" className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed cursor-pointer">
                  <Shield className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  Li e concordo com a{" "}
                  <LGPDTermsDialog>
                    <span className="text-primary font-semibold underline cursor-pointer">
                      Política de Privacidade e Termos de Uso (LGPD)
                    </span>
                  </LGPDTermsDialog>
                  . Autorizo o tratamento dos meus dados pessoais conforme descrito.
                </label>
              </div>
            )}

            {/* Email form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authMode === "signup" && (
                <Input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome" className="bg-[hsl(var(--dark-card))] border-none"
                  required
                />
              )}
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail" className="bg-[hsl(var(--dark-card))] border-none"
                required
              />
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha" className="bg-[hsl(var(--dark-card))] border-none"
                required minLength={6}
              />
              <Button type="submit" className="w-full" disabled={authSubmitting}>
                {authSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
                {authMode === "login" ? "Entrar com e-mail" : "Criar conta"}
              </Button>
            </form>

            <button
              onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}
              className="w-full text-center text-sm text-primary font-semibold py-2"
            >
              {authMode === "login" ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </div>
        </div>
      );
    }
  }

  // Verse history view
  if (view === "verse-history") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Versículos do Dia</h1>
        </header>
        <div className="px-5 space-y-3">
          {verseHistory.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-10">Nenhum versículo do dia registrado ainda.</p>
          ) : (
            verseHistory.map((entry) => (
              <div key={entry.date} className="bg-dark-card rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-primary">{entry.ref}</span>
                  <span className="text-[10px] text-dark-muted">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm leading-relaxed text-dark-text/90">"{entry.text}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "saved") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Versículos Salvos</h1>
        </header>
        <div className="px-5 space-y-3">
          {savedVerses.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-10">Nenhum versículo salvo ainda.</p>
          ) : (
            [...savedVerses].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((verse) => (
              <div key={`${verse.reference}-${verse.savedAt}`} className="bg-dark-card rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-2">{verse.reference}</p>
                <p className="text-sm leading-relaxed">"{verse.text}"</p>
                <button onClick={() => setSavedVerses((prev) => prev.filter((item) => item.savedAt !== verse.savedAt))}
                  className="mt-3 flex items-center gap-1 text-xs text-destructive">
                  <Trash2 className="w-3 h-3" /> Remover
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "history") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Histórico de Leitura</h1>
        </header>
        <div className="px-5 space-y-4">
          <div className="bg-dark-card rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-dark-muted mb-2">Última leitura</p>
            <p className="font-semibold text-sm">{progress ? `${progress.bookName} ${progress.chapter}` : "Nenhuma leitura recente"}</p>
            <p className="text-xs text-dark-muted mt-1">{progress ? new Date(progress.lastRead).toLocaleString("pt-BR") : "Abra um capítulo para começar"}</p>
          </div>
          <div className="bg-dark-card rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-dark-muted mb-3">Dias lidos</p>
            {readingHistory.length === 0 ? (
              <p className="text-sm text-dark-muted">Seu histórico vai aparecer aqui.</p>
            ) : (
              <div className="space-y-2">
                {readingHistory.slice(0, 30).map((date) => (
                  <div key={date} className="flex items-center justify-between rounded-xl bg-dark-bg px-3 py-3">
                    <span className="text-sm">{formatDate(date)}</span>
                    <span className="text-xs text-primary font-semibold">Lido</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="pb-20 min-h-screen">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Configurações</h1>
        </header>
        <div className="px-5 space-y-3">
          <button onClick={togglePush} disabled={pushLoading}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors flex items-center gap-3">
            {pushEnabled ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-dark-muted" />}
            <div className="flex-1">
              <p className="font-semibold text-sm">Notificações</p>
              <p className="text-xs text-dark-muted mt-1">
                {pushEnabled ? "Versículo do dia às 8h ativado" : "Receba o versículo do dia às 8h"}
              </p>
            </div>
            {pushLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <span className={`text-xs font-semibold ${pushEnabled ? "text-primary" : "text-dark-muted"}`}>
                {pushEnabled ? "Ativado" : "Ativar"}
              </span>
            )}
          </button>
          <div className="bg-dark-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Download className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Bíblia Offline</p>
            </div>
            <p className="text-xs text-dark-muted mb-3">Baixe versões para ler sem internet.</p>
            <BibleDownloadManager />
          </div>
          <button onClick={handleContinueReading} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
            <p className="font-semibold text-sm">Continuar leitura</p>
            <p className="text-xs text-dark-muted mt-1">Retomar exatamente de onde você parou.</p>
          </button>
          <button onClick={() => navigate("/descubra")} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
            <p className="font-semibold text-sm">Explorar temas</p>
            <p className="text-xs text-dark-muted mt-1">Abrir a busca inteligente de versículos e capítulos.</p>
          </button>
          <button onClick={() => navigate("/planos")} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
            <p className="font-semibold text-sm">Meus planos</p>
            <p className="text-xs text-dark-muted mt-1">Ver os planos iniciados e acompanhar o progresso.</p>
          </button>
          <button onClick={clearSavedVerses} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
            <p className="font-semibold text-sm text-destructive">Apagar versículos salvos</p>
            <p className="text-xs text-dark-muted mt-1">Limpar sua lista de versículos guardados.</p>
          </button>
          <button onClick={resetReadingData} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
            <p className="font-semibold text-sm text-destructive">Reiniciar progresso</p>
            <p className="text-xs text-dark-muted mt-1">Zerar sequência e última leitura do aplicativo.</p>
          </button>
          {user && (
            <button onClick={handleSignOut} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
              <p className="font-semibold text-sm text-destructive flex items-center gap-2">
                <LogOut className="w-4 h-4" /> Sair da conta
              </p>
              <p className="text-xs text-dark-muted mt-1">{user.email}</p>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Overview (logged in)
  const displayName = profile?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Leitor";
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url;

  return (
    <div className="pb-20 min-h-screen">
      <header className="px-5 pt-12 pb-6">
        <h1 className="text-2xl font-bold">Você</h1>
      </header>

      <div className="px-5 mb-6">
        <div className="bg-dark-card rounded-2xl p-5 flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center text-2xl">
              🙏
            </div>
          )}
          <div>
            <p className="font-bold text-lg">{displayName}</p>
            <p className="text-sm text-dark-muted">
              {savedVerses.length} versículo{savedVerses.length !== 1 ? "s" : ""} salvo{savedVerses.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 grid grid-cols-2 gap-3 mb-6">
        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Sequência</span>
          </div>
          <p className="text-2xl font-bold">{getDisplayStreak(streak)}</p>
          <p className="text-xs text-dark-muted mt-1">dia{getDisplayStreak(streak) !== 1 ? "s" : ""} seguidos</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <BookOpenText className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Última leitura</span>
          </div>
          <p className="text-sm font-bold line-clamp-1">{progress ? `${progress.bookName} ${progress.chapter}` : "Nenhuma"}</p>
          <p className="text-xs text-dark-muted mt-1">{progress ? "Pronto para continuar" : "Comece hoje"}</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <BookmarkCheck className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Salvos</span>
          </div>
          <p className="text-2xl font-bold">{savedVerses.length}</p>
          <p className="text-xs text-dark-muted mt-1">versículos guardados</p>
        </div>

        <div className="bg-dark-card rounded-2xl p-4">
          <div className="flex items-center gap-2 text-primary mb-2">
            <Compass className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Planos</span>
          </div>
          <p className="text-2xl font-bold">{activePlansCount}</p>
          <p className="text-xs text-dark-muted mt-1">em andamento</p>
        </div>
      </div>

      <div className="px-5 mb-6">
        <button onClick={handleContinueReading}
          className="w-full bg-primary text-primary-foreground rounded-2xl p-4 text-left active:opacity-90 transition-opacity">
          <p className="font-semibold text-sm">Continuar leitura</p>
          <p className="text-xs opacity-90 mt-1">{progress ? `${progress.bookName} ${progress.chapter}` : "Abrir Gênesis 1 agora"}</p>
        </button>
      </div>

      {recentSavedVerses.length > 0 && (
        <div className="px-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-dark-muted uppercase tracking-wider">Recentes</h2>
            <button onClick={() => setView("saved")} className="text-xs text-primary font-semibold">Ver todos</button>
          </div>
          <div className="space-y-2">
            {recentSavedVerses.map((verse) => (
              <div key={verse.savedAt} className="bg-dark-card rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-1">{verse.reference}</p>
                <p className="text-sm text-dark-muted line-clamp-2">"{verse.text}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-5 space-y-1">
        {[
          { key: "saved", label: "Versículos salvos", icon: BookmarkCheck, value: String(savedVerses.length) },
          { key: "verse-history", label: "Versículos do dia", icon: Sparkles, value: verseHistory.length ? `${verseHistory.length} dias` : "Vazio" },
          { key: "history", label: "Histórico de leitura", icon: Clock3, value: readingHistory.length ? formatDate(readingHistory[0]) : "Vazio" },
          { key: "settings", label: "Configurações", icon: Settings, value: "Gerenciar" },
        ].map((item) => (
          <button key={item.key} onClick={() => setView(item.key as ProfileView)}
            className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-dark-card transition-colors text-left">
            <item.icon className="w-5 h-5 text-dark-muted" />
            <span className="flex-1 text-sm font-medium">{item.label}</span>
            <span className="text-xs text-dark-muted">{item.value}</span>
            <ChevronRight className="w-4 h-4 text-dark-muted" />
          </button>
        ))}
        <button onClick={() => navigate("/descubra")}
          className="w-full flex items-center gap-4 py-4 px-4 rounded-xl active:bg-dark-card transition-colors text-left">
          <Compass className="w-5 h-5 text-dark-muted" />
          <span className="flex-1 text-sm font-medium">Descobrir versículos</span>
          <ChevronRight className="w-4 h-4 text-dark-muted" />
        </button>
      </div>

      <div className="px-5 mt-6 text-center">
        <button onClick={resetReadingData} className="inline-flex items-center gap-2 text-xs text-dark-muted font-semibold">
          <RotateCcw className="w-3 h-3" /> Reiniciar meus dados locais
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
