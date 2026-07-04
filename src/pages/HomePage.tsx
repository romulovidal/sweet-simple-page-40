import { useState, useEffect } from "react";
 import { Search, Loader2, Play, Heart, BookOpen, FileText, Megaphone, MessageCircleQuestion } from "lucide-react";
import AIDevotional from "@/components/ai/AIDevotional";
 import { useAppFeatures } from "@/hooks/useAppFeatures";
 import { useAIFeatures } from "@/hooks/useAIFeatures";
import StreakBadge from "@/components/StreakBadge";
import VerseCard from "@/components/VerseCard";
import CultoScheduleList from "@/components/CultoScheduleList";
import PrayerRequests from "@/components/PrayerRequests";
import PostPreviewDialog from "@/components/PostPreviewDialog";
import PageHead from "@/components/PageHead";
import { useNavigate } from "react-router-dom";
import { useLocalStorage, type ReadingProgress, type StreakData, type DailyVerseEntry, getDisplayStreak } from "@/hooks/useLocalStorage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readJsonStorage, writeJsonStorage } from "@/lib/localData";

type AdminPost = Database["public"]["Tables"]["admin_posts"]["Row"];

const DAILY_VERSE_CACHE_KEY = "daily-verse-cache";
const ADMIN_POSTS_CACHE_KEY = "cached-admin-posts";

const HomePage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
   const { features: appFeatures } = useAppFeatures();
   const { features: aiFeatures } = useAIFeatures();
  const [activeTab, setActiveTab] = useState<"hoje" | "comunidade">(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "comunidade") return "comunidade";
    }
    return "hoje";
  });

  // Reage a mudanças de URL (ex: clique em notificação push abrindo /?tab=comunidade
  // enquanto o app já está aberto)
  useEffect(() => {
    const syncTabFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "comunidade") {
        setActiveTab("comunidade");
        const url = new URL(window.location.href);
        url.searchParams.delete("tab");
        window.history.replaceState({}, "", url.pathname + (url.search || ""));
      }
    };
    window.addEventListener("popstate", syncTabFromUrl);
    return () => window.removeEventListener("popstate", syncTabFromUrl);
  }, []);
  const [streak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });
  const [progress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);

  // Daily verse
  const [verse, setVerse] = useState<{ text: string; ref: string; versionShortName?: string } | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [, setVerseHistory] = useLocalStorage<DailyVerseEntry[]>("daily-verse-history", []);

  const [adminPosts, setAdminPosts] = useState<AdminPost[]>(() => readJsonStorage<AdminPost[]>(ADMIN_POSTS_CACHE_KEY, []));
  const [previewPost, setPreviewPost] = useState<AdminPost | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadVerse = async () => {
      window.localStorage.removeItem(DAILY_VERSE_CACHE_KEY);

      if (!cancelled) {
        setVerse(null);
        setVerseLoading(true);
      }

      try {
        const { data: queueVerse, error } = await supabase
          .from("current_daily_verse" as never)
          .select("verse_text, verse_ref, scheduled_date")
          .maybeSingle();

        if (error) throw error;

        if (!queueVerse) {
          if (!cancelled) {
            setVerse(null);
            setVerseLoading(false);
          }
          return;
        }

        const row = queueVerse as { verse_text: string; verse_ref: string; scheduled_date: string };
        const finalVerse = { text: row.verse_text, ref: row.verse_ref };

        if (!cancelled) {
          setVerse(finalVerse);
          setVerseLoading(false);
          setVerseHistory((prev) => {
            const filtered = prev.filter((entry) => entry.date !== row.scheduled_date);
            return [{ date: row.scheduled_date, ...finalVerse }, ...filtered].slice(0, 90);
          });
        }
      } catch (err) {
        console.error("Erro ao carregar versículo manual do admin:", err);
        if (!cancelled) {
          setVerse(null);
          setVerseLoading(false);
        }
      }
    };

    loadVerse();

    // Re-check when the app regains focus or comes back online — handles cases where
    // the app stayed open across midnight or admin pushed a manual verse mid-day.
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadVerse();
    };
    const onFocus = () => loadVerse();
    const onOnline = () => loadVerse();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    // Tempo real: quando o admin salva/edita/remove um versículo, todos os dispositivos atualizam.
    const realtimeChannel = supabase
      .channel("daily-verse-queue-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_verse_queue" },
        () => loadVerse()
      )
      .subscribe();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      supabase.removeChannel(realtimeChannel);
    };
  }, [setVerseHistory]);

  // Fetch admin posts
  useEffect(() => {
    let cancelled = false;

    supabase
      .from("admin_posts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        setAdminPosts(data);
        writeJsonStorage(ADMIN_POSTS_CACHE_KEY, data, false, "cache");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinueReading = () => {
    if (progress) {
      navigate(`/biblia?book=${progress.bookAbbrev}&chapter=${progress.chapter}`);
    } else {
      navigate(`/biblia?book=gn&chapter=1`);
    }
  };

  const extractYoutubeId = (url: string) => {
    const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  };

  const postIcon = (type: string) => {
    switch (type) {
      case "versiculo": return BookOpen;
      case "oracao": return Heart;
      case "video": return Play;
      case "anuncio": return Megaphone;
      default: return FileText;
    }
  };

  const POST_TYPES_LABELS: Record<string, string> = {
    versiculo: "Versículo", oracao: "Oração", video: "Vídeo",
    devocional: "Devocional", anuncio: "Anúncio",
  };

  return (
    <div className="pb-20 min-h-screen">
      <PageHead
        title="Bíblia do Atalaia — Versículo do Dia, Leia e Medite"
        description="Comece o dia com o versículo do Atalaia, mantenha sua sequência de leitura e receba a Palavra que Deus tem para você hoje."
        path="/"
        breadcrumbs={[{ name: "Início", path: "/" }]}
      />
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between lg:pt-8">
        <div data-tour="home-streak"><StreakBadge days={getDisplayStreak(streak)} /></div>
        <button
          onClick={() => navigate("/descubra")}
          data-tour="home-search"
          className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
        >
          <Search className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
        </button>
      </header>

      {/* Tabs */}
      <div className="px-5 flex gap-6 border-b border-[hsl(var(--dark-card))]">
        {(["hoje", "comunidade"] as const).map((tab) => (
          <button
            key={tab}
            data-tour={tab === "comunidade" ? "home-tab-comunidade" : undefined}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? "text-[hsl(var(--dark-text))] border-b-2 border-[hsl(var(--dark-text))]"
                : "text-[hsl(var(--dark-muted))]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-5 pt-6 space-y-8 max-w-6xl mx-auto lg:px-8">
        {activeTab === "hoje" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-8">
                 {/* Greeting */}
                 <div>
                   <h1 className="text-2xl font-bold">Olá {profile?.display_name || "Visitante"},</h1>
                   <p className="text-lg font-medium mt-1">Seja bem-vindo(a) à Bíblia do Atalaia 👋</p>
                   <p className="text-[hsl(var(--dark-muted))] text-sm mt-1">
                     {getDisplayStreak(streak) > 0
                       ? `Você está numa ofensiva de ${getDisplayStreak(streak)} dia${getDisplayStreak(streak) > 1 ? "s" : ""}!`
                       : "Comece sua leitura de hoje!"}
                   </p>
                 </div>

                {/* Verse of the Day */}
                <div data-tour="home-verse-of-day">
                  <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
                    Versículo do dia
                  </h2>
                  {verseLoading ? (
                    <div className="bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] rounded-2xl p-6 flex items-center justify-center h-40">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  ) : verse ? (
                    <VerseCard 
                      text={verse.text} 
                      reference={verse.ref} 
                      version={verse.versionShortName} 
                    />
                  ) : null}
                   {!verseLoading && verse && (
                     <AIDevotional verseRef={verse.ref} verseText={verse.text} enabled={aiFeatures.devotional} />
                   )}
                </div>
              </div>

              <div className="space-y-8">
                {/* Continue Reading */}
                <div data-tour="home-continue">
                  <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
                    Continuar lendo
                  </h2>
                  <button
                    onClick={handleContinueReading}
                    className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-4 active:bg-[hsl(var(--dark-card-hover))] transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center text-lg">
                      📖
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {progress ? `${progress.bookName} ${progress.chapter}` : "Gênesis 1"}
                      </p>
                      <p className="text-xs text-[hsl(var(--dark-muted))]">
                        {progress ? "Continue de onde parou" : "Comece a ler agora"}
                      </p>
                    </div>
                    <span className="text-xs text-[hsl(var(--dark-muted))]">→</span>
                  </button>
                </div>

              </div>
            </div>

            {/* Admin Posts Feed - Full Width */}
            {adminPosts.length > 0 && (
              <div className="space-y-4 pt-4">
                <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                  Destaques e Avisos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminPosts.map((post) => {
                  const Icon = postIcon(post.type);
                  const videoId = post.youtube_url ? extractYoutubeId(post.youtube_url) : null;
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setPreviewPost(post)}
                      className="bg-[hsl(var(--dark-card))] rounded-2xl overflow-hidden text-left active:scale-[0.99] hover:bg-[hsl(var(--dark-card-hover))] transition-all"
                    >
                      {post.type === "video" && videoId && (
                        <div className="relative aspect-video bg-black">
                          <img
                            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-14 h-14 rounded-full bg-primary/95 flex items-center justify-center shadow-xl ring-4 ring-white/20">
                              <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                            {POST_TYPES_LABELS[post.type] || post.type}
                          </span>
                          {post.bible_reference && (
                            <span className="text-[10px] text-[hsl(var(--dark-muted))] ml-auto">{post.bible_reference}</span>
                          )}
                        </div>
                        <h3 className="font-bold text-sm mb-1">{post.title}</h3>
                        <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed line-clamp-3">{post.content}</p>
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-8 pb-6">
            {/* Destaques e Avisos (Comunidade) */}
            {adminPosts.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                  Destaques e Avisos
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adminPosts.map((post) => {
                  const Icon = postIcon(post.type);
                  const videoId = post.youtube_url ? extractYoutubeId(post.youtube_url) : null;
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => setPreviewPost(post)}
                      className="bg-[hsl(var(--dark-card))] rounded-2xl overflow-hidden border border-white/5 text-left active:scale-[0.99] hover:bg-[hsl(var(--dark-card-hover))] transition-all"
                    >
                      {post.type === "video" && videoId && (
                        <div className="relative aspect-video bg-black">
                          <img
                            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="w-14 h-14 rounded-full bg-primary/95 flex items-center justify-center shadow-xl ring-4 ring-white/20">
                              <Play className="w-6 h-6 text-primary-foreground fill-current ml-0.5" />
                            </span>
                          </span>
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-[10px] text-primary font-semibold uppercase tracking-wider">
                            {POST_TYPES_LABELS[post.type] || post.type}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">{post.title}</h3>
                        <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed line-clamp-3">{post.content}</p>
                        {post.bible_reference && (
                          <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="text-xs font-bold text-primary">{post.bible_reference}</span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-md font-bold uppercase">
                              Abrir
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              <div className="space-y-6">
                <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">Escala de Cultos</h2>
                <CultoScheduleList />
              </div>
              <div className="space-y-6">
                <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">Mural de Orações</h2>
                <PrayerRequests enabled={true} />
              </div>
            </div>
          </div>
        )}
      </div>
      <PostPreviewDialog post={previewPost} open={previewPost !== null} onOpenChange={(o) => !o && setPreviewPost(null)} />
    </div>
  );
};

export default HomePage;
