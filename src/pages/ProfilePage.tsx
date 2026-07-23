import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookmarkCheck, BookOpenText, ChevronRight, Clock3, Compass,
   Flame, RotateCcw, Settings, Trash2, Sparkles, LogOut, Loader2, Mail, Shield, Download, Bell, BellOff, GraduationCap, Medal, FileText, UserX, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { triggerAppTour } from "@/hooks/useAppTour";
import BibleDownloadManager from "@/components/BibleDownloadManager";
import { registerPushNotifications, isPushEnabled, unregisterPush } from "@/lib/pushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLocalStorage, type ReadingProgress, type SavedVerse, type StreakData, type DailyVerseEntry, getDisplayStreak } from "@/hooks/useLocalStorage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import LGPDTermsDialog from "@/components/LGPDTermsDialog";
import ReadingGoals from "@/components/ReadingGoals";
import { useAppFeatures } from "@/hooks/useAppFeatures";
import PageHead from "@/components/PageHead";

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

type ProfileView = "overview" | "saved" | "history" | "verse-history" | "settings" | "auth";

const ProfilePage = () => {
  const graduationCapIcon = GraduationCap;
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const { features: appFeatures } = useAppFeatures();
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
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // WhatsApp preferences (logged-in user)
  const [waNumber, setWaNumber] = useState("");
  const [waOptIn, setWaOptIn] = useState(false);
  const [waSaving, setWaSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp, whatsapp_opt_in")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setWaNumber((data as any).whatsapp ?? "");
          setWaOptIn(!!(data as any).whatsapp_opt_in);
        }
      });
  }, [user]);

  const saveWhatsappPrefs = async () => {
    if (!user) return;
    const digits = waNumber.replace(/\D/g, "");
    if (waOptIn && digits.length < 10) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }
    setWaSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        whatsapp: digits || null,
        whatsapp_opt_in: digits ? waOptIn : false,
      })
      .eq("user_id", user.id);
    setWaSaving(false);
    if (error) toast.error("Não foi possível salvar.");
    else {
      toast.success(waOptIn && digits ? "Notificações no WhatsApp ativadas!" : "Preferências salvas.");
      setWaNumber(digits);
    }
  };

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

  const handleMenuClick = (key: string) => {
    if (key === "manual") {
      navigate("/manual");
    } else {
      setView(key as ProfileView);
    }
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
        const digits = whatsapp.replace(/\D/g, "");
        if (whatsappOptIn && digits.length < 10) {
          toast.error("Para receber no WhatsApp, informe um número válido com DDD.");
          setAuthSubmitting(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: name,
              whatsapp: digits || null,
              whatsapp_opt_in: whatsappOptIn && !!digits,
            },
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




  const handleSignOut = async () => {
    await signOut();
    toast.success("Você saiu da conta.");
    setView("overview");
  };

  const handleDeleteAccount = async () => {
    const first = window.prompt(
      'Isso apagará permanentemente sua conta e todos os dados associados (versículos salvos, notas, progresso, favoritos).\n\nDigite EXCLUIR para confirmar:'
    );
    if (first !== "EXCLUIR") {
      if (first !== null) toast("Confirmação incorreta. Nada foi excluído.");
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      try { localStorage.clear(); } catch {}
      await supabase.auth.signOut();
      toast.success("Conta excluída. Sentiremos sua falta.");
      navigate("/");
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível excluir a conta agora.");
    } finally {
      setDeletingAccount(false);
    }
  };

  // Loading state
  if (authLoading) {
    return (
      <>
        <PageHead title="Meu Perfil — A Bíblia do Atalaia" description="Seus versículos salvos, sequência de leitura, planos e configurações pessoais." path="/perfil" noindex />
        <div className="pb-20 min-h-screen flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </>
    );
  }

  // Auth view (login/signup)
  if (!user || view === "auth") {
    if (!user) {
      return (
        <>
        <PageHead title="Entrar — A Bíblia do Atalaia" description="Entre ou cadastre-se para salvar seu progresso, versículos e sequência de leitura." path="/perfil" noindex />
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
              {authMode === "signup" && (
                <>
                  <Input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="WhatsApp com DDD (opcional) — ex: 85999999999"
                    className="bg-[hsl(var(--dark-card))] border-none"
                    inputMode="tel"
                  />
                  <label className="flex items-start gap-3 bg-[hsl(var(--dark-card))] rounded-2xl p-3 cursor-pointer">
                    <Checkbox
                      id="wa-optin"
                      checked={whatsappOptIn}
                      onCheckedChange={(c) => setWhatsappOptIn(c === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-[hsl(var(--dark-muted))] leading-relaxed">
                      <MessageCircle className="w-3.5 h-3.5 inline mr-1 text-primary" />
                      Desejo receber notificações no WhatsApp (versículo do dia, devocional, lembretes de cultos e avisos da comunidade). Você pode desativar a qualquer momento.
                    </span>
                  </label>
                </>
              )}
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

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2 pt-2">
              Ao {authMode === "login" ? "entrar" : "criar sua conta"}, você concorda com os{" "}
              <a href="/termos" className="text-primary underline">Termos de Uso</a> e a{" "}
              <a href="/privacidade" className="text-primary underline">Política de Privacidade</a>.
            </p>
          </div>
        </div>
        </>
      );
    }
  }

  // Verse history view
  if (view === "verse-history") {
    return (
      <div className="pb-20 min-h-screen max-w-6xl mx-auto">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3 max-w-2xl mx-auto lg:pt-8">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Versículos do Dia</h1>
        </header>
        <div className="px-5 space-y-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {verseHistory.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-10 col-span-full">Nenhum versículo do dia registrado ainda.</p>
          ) : (
            verseHistory.map((entry) => (
              <div key={entry.date} className="bg-[hsl(var(--dark-card))] border border-white/5 rounded-2xl p-5 hover:bg-[hsl(var(--dark-card-hover))] transition-colors shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-primary">{entry.ref}</span>
                  <span className="text-[10px] font-medium text-[hsl(var(--dark-muted))] bg-white/5 px-2 py-0.5 rounded-full">{formatDate(entry.date)}</span>
                </div>
                <p className="text-sm leading-relaxed text-[hsl(var(--dark-text))]/90 italic">"{entry.text}"</p>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (view === "saved") {
    return (
      <div className="pb-20 min-h-screen max-w-6xl mx-auto">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3 max-w-2xl mx-auto lg:pt-8">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Versículos Salvos</h1>
        </header>
        <div className="px-5 space-y-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedVerses.length === 0 ? (
            <p className="text-sm text-dark-muted text-center py-10 col-span-full">Nenhum versículo salvo ainda.</p>
          ) : (
            [...savedVerses].sort((a, b) => b.savedAt.localeCompare(a.savedAt)).map((verse) => (
              <div key={`${verse.reference}-${verse.savedAt}`} className="bg-[hsl(var(--dark-card))] border border-white/5 rounded-2xl p-5 hover:bg-[hsl(var(--dark-card-hover))] transition-colors shadow-sm flex flex-col h-full">
                <p className="text-sm font-bold text-primary mb-3">{verse.reference}</p>
                <p className="text-sm leading-relaxed mb-4 flex-1">"{verse.text}"</p>
                <button onClick={() => setSavedVerses((prev) => prev.filter((item) => item.savedAt !== verse.savedAt))}
                  className="mt-auto flex items-center gap-1.5 text-xs text-destructive hover:opacity-80 transition-opacity font-medium">
                  <Trash2 className="w-3.5 h-3.5" /> Remover
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
        <div className="px-5 space-y-4 max-w-4xl mx-auto">
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
      <div className="pb-20 min-h-screen max-w-4xl mx-auto">
        <header className="px-5 pt-12 pb-6 flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => setView("overview")} className="text-primary text-sm font-semibold">← Voltar</button>
          <h1 className="text-lg font-bold">Configurações</h1>
        </header>
        <div className="px-5 space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-4xl mx-auto">
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
          <div className="bg-dark-card rounded-xl p-4 sm:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <p className="font-semibold text-sm">Notificações no WhatsApp</p>
            </div>
            <p className="text-xs text-dark-muted mb-3">
              Receba o versículo do dia, devocional, lembretes de cultos e avisos direto no seu WhatsApp pelo Atis.
            </p>
            <Input
              type="tel"
              inputMode="tel"
              placeholder="WhatsApp com DDD — ex: 85999999999"
              value={waNumber}
              onChange={(e) => setWaNumber(e.target.value)}
              className="bg-dark-bg border-none mb-3"
            />
            <label className="flex items-start gap-3 cursor-pointer mb-3">
              <Checkbox
                checked={waOptIn}
                onCheckedChange={(c) => setWaOptIn(c === true)}
                className="mt-0.5"
              />
              <span className="text-xs text-dark-muted leading-relaxed">
                Autorizo receber mensagens automáticas do Atis no meu WhatsApp. Posso desativar quando quiser.
              </span>
            </label>
            <Button onClick={saveWhatsappPrefs} disabled={waSaving} size="sm" className="w-full">
              {waSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar preferências
            </Button>
          </div>
          <button onClick={handleContinueReading} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors">
            <p className="font-semibold text-sm">Continuar leitura</p>
            <p className="text-xs text-dark-muted mt-1">Retomar exatamente de onde você parou.</p>
          </button>
          <button
            onClick={() => { triggerAppTour(); toast.success("Tour reiniciado!"); setView("overview"); }}
            className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors flex items-center gap-3"
          >
            <GraduationCap className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Refazer tour do app</p>
              <p className="text-xs text-dark-muted mt-1">Reveja todas as funcionalidades passo a passo.</p>
            </div>
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
          <button onClick={() => navigate("/privacidade")} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Política de Privacidade</p>
              <p className="text-xs text-dark-muted mt-1">Como tratamos seus dados (LGPD).</p>
            </div>
          </button>
          <button onClick={() => navigate("/termos")} className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors flex items-center gap-3">
            <FileText className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Termos de Uso</p>
              <p className="text-xs text-dark-muted mt-1">Regras e responsabilidades.</p>
            </div>
          </button>
          {user && (
            <button
              onClick={handleDeleteAccount}
              disabled={deletingAccount}
              className="w-full bg-dark-card rounded-xl p-4 text-left active:bg-dark-card-hover transition-colors flex items-center gap-3 disabled:opacity-60 sm:col-span-2"
            >
              {deletingAccount ? <Loader2 className="w-5 h-5 animate-spin text-destructive" /> : <UserX className="w-5 h-5 text-destructive" />}
              <div className="flex-1">
                <p className="font-semibold text-sm text-destructive">Excluir minha conta</p>
                <p className="text-xs text-dark-muted mt-1">
                  Apaga permanentemente conta, versículos salvos, notas, progresso e favoritos.
                </p>
              </div>
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
    <div className="pb-20 min-h-screen max-w-6xl mx-auto lg:px-8">
      <PageHead
        title="Meu Perfil — A Bíblia do Atalaia"
        description="Seus versículos salvos, sequência de leitura, planos e configurações pessoais."
        path="/perfil"
        noindex
      />
      <header className="px-5 pt-12 pb-6 max-w-2xl mx-auto lg:pt-8 lg:mx-0">
        <h1 className="text-2xl font-bold">Você</h1>
      </header>

      <div className="px-5 mb-6 max-w-2xl mx-auto">
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

      <div className="px-5 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8" data-tour="profile-stats">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-5 mb-8">
        {/* Reading Goals */}
        <div data-tour="profile-goals">
          <ReadingGoals enabled={appFeatures.reading_goals} />
        </div>

        <div>
          <button onClick={handleContinueReading}
            className="w-full bg-primary text-primary-foreground rounded-2xl p-4 h-full text-left active:opacity-90 transition-opacity flex flex-col justify-center">
            <p className="font-semibold text-sm">Continuar leitura</p>
            <p className="text-xs opacity-90 mt-1">{progress ? `${progress.bookName} ${progress.chapter}` : "Abrir Gênesis 1 agora"}</p>
          </button>
        </div>
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

      <div className="px-5 space-y-1 grid grid-cols-1 md:grid-cols-2 gap-x-6" data-tour="profile-menu">
        {[
          { key: "saved", label: "Versículos salvos", icon: BookmarkCheck, value: String(savedVerses.length) },
          { key: "verse-history", label: "Versículos do dia", icon: Sparkles, value: verseHistory.length ? `${verseHistory.length} dias` : "Vazio" },
          { key: "history", label: "Histórico de leitura", icon: Clock3, value: readingHistory.length ? formatDate(readingHistory[0]) : "Vazio" },
          { key: "manual", label: "Manual do Usuário", icon: graduationCapIcon, value: "Aprender" },
          { key: "settings", label: "Configurações", icon: Settings, value: "Gerenciar" },
        ].map((item) => (
          <button key={item.key} onClick={() => handleMenuClick(item.key)}
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

      {isAdmin && (
        <button onClick={() => navigate("/admin")}
          className="fixed bottom-24 right-5 z-30 bg-primary text-primary-foreground rounded-full w-11 h-11 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          title="Área admin"
        >
          <Shield className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default ProfilePage;
