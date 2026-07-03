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
import { getDailyVerse } from "@/data/bible";
import { useNavigate } from "react-router-dom";
import { useLocalStorage, type ReadingProgress, type StreakData, type DailyVerseEntry, getDisplayStreak } from "@/hooks/useLocalStorage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readJsonStorage, writeJsonStorage } from "@/lib/localData";
import { getVerseTextByReference, getVersesTextByNumbers, parseReference, DAILY_VERSE_VERSION_KEY, DEFAULT_DAILY_VERSION } from "@/lib/dailyVerseVersion";

type AdminPost = Database["public"]["Tables"]["admin_posts"]["Row"];

const DAILY_VERSE_CACHE_KEY = "daily-verse-cache";
const DAILY_VERSE_CACHE_VERSION = 6; // Bump this to force all users to refresh

type CachedDailyVerse = {
  date: string;
  version?: number;
  source?: "manual" | "auto";
  verse: { text: string; ref: string };
};
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

    const getToday = () => {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());
        const year = parts.find((part) => part.type === "year")?.value;
        const month = parts.find((part) => part.type === "month")?.value;
        const day = parts.find((part) => part.type === "day")?.value;
        if (year && month && day) return `${year}-${month}-${day}`;
      } catch { /* fall back to device date */ }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const getActiveVersion = async (): Promise<string> => {
      try {
        const { data } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("key", DAILY_VERSE_VERSION_KEY)
          .maybeSingle();
        if (!data) return DEFAULT_DAILY_VERSION;
        const val = typeof data.value === "string" ? data.value : JSON.stringify(data.value);
        return (val.replace(/"/g, "") || DEFAULT_DAILY_VERSION).toLowerCase();
      } catch {
        return DEFAULT_DAILY_VERSION;
      }
    };

    const applyVersion = async (
      v: { text: string; ref: string },
      versionId: string
    ): Promise<{ text: string; ref: string }> => {
      // Detect multi-verse refs like "João 3:16-17" or "João 3:16,18"
      const versePart = v.ref.split(":")[1]?.trim() ?? "";
      const hasRange = /[,-]/.test(versePart);
      if (hasRange) {
        const parsed = parseReference(v.ref);
        if (parsed) {
          const nums: number[] = [];
          for (const seg of versePart.split(",")) {
            const [a, b] = seg.split("-").map((n) => parseInt(n, 10));
            if (Number.isNaN(a)) continue;
            if (Number.isNaN(b)) nums.push(a);
            else for (let i = a; i <= b; i++) nums.push(i);
          }
          if (nums.length > 0) {
            const text = await getVersesTextByNumbers(parsed.bookName, parsed.chapter, nums, versionId);
            if (text) return { text, ref: v.ref };
          }
        }
        return v;
      }
      const text = await getVerseTextByReference(v.ref, versionId);
      return text ? { text, ref: v.ref } : v;
    };

    const tryManualVerse = async (today: string): Promise<{ text: string; ref: string } | null> => {
      try {
        const { data: queueVerse, error } = await supabase
          .from("daily_verse_queue")
          .select("verse_text, verse_ref")
          .lte("scheduled_date", today)
          .order("scheduled_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (queueVerse) {
          return { text: queueVerse.verse_text, ref: queueVerse.verse_ref };
        }
      } catch { /* fall through */ }
      return null;
    };

    const loadVerse = async (force = false) => {
      const today = getToday();
      const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
      const cached = readJsonStorage<CachedDailyVerse | null>(DAILY_VERSE_CACHE_KEY, null);

      const isCacheValid = !force && cached?.date === today && (cached.version ?? 0) >= DAILY_VERSE_CACHE_VERSION && !!cached.verse?.text;

      // 1. Mostrar o cache imediatamente se for válido (velocidade)
      if (isCacheValid && !cancelled) {
        setVerse(cached.verse);
        setVerseLoading(false);
        setVerseHistory((prev) => {
          if (prev.some((e) => e.date === today)) return prev;
          return [{ date: today, ...cached.verse }, ...prev].slice(0, 90);
        });
      } else if (!cancelled) {
        // Sem cache confiável: mantém o card em carregamento para não exibir versículo automático antigo.
        setVerse(null);
        setVerseLoading(true);
      }

      // 2. Se estiver online, sempre buscar a versão atual (Tempo Real)
      if (isOnline) {
        try {
          const activeVersion = await getActiveVersion();
          const manual = await tryManualVerse(today);
          
          let finalVerse: { text: string; ref: string };
          let source: "manual" | "auto" = "auto";

          if (manual) {
            finalVerse = await applyVersion(manual, activeVersion);
            source = "manual";
          } else {
            finalVerse = await applyVersion(getDailyVerse(), activeVersion);
          }

          if (!cancelled) {
            setVerse({ ...finalVerse, versionShortName: activeVersion.toUpperCase() });
            setVerseLoading(false);
            
            // Atualizar cache se algo mudou ou se é um novo dia
            if (!isCacheValid || cached?.verse.text !== finalVerse.text || cached?.verse.ref !== finalVerse.ref || cached?.source !== source) {
              writeJsonStorage(
                DAILY_VERSE_CACHE_KEY,
                { date: today, version: DAILY_VERSE_CACHE_VERSION, source, verse: finalVerse },
                false,
                "cache"
              );
              
              setVerseHistory((prev) => {
                const filtered = prev.filter((e) => e.date !== today);
                return [{ date: today, ...finalVerse }, ...filtered].slice(0, 90);
              });
            }
          }
        } catch (err) {
          console.error("Erro ao carregar versículo em tempo real:", err);
          if (!cancelled && !isCacheValid) setVerseLoading(false);
        }
      } else {
        if (!cancelled) setVerseLoading(false);
      }
    };

    loadVerse();

    // Re-check when the app regains focus or comes back online — handles cases where
    // the app stayed open across midnight or admin pushed a manual verse mid-day.
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadVerse();
    };
    const onFocus = () => loadVerse();
    const onOnline = () => loadVerse(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
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
                  {verseLoading || !verse ? (
                    <div className="bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] rounded-2xl p-6 flex items-center justify-center h-40">
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  ) : (
                    <VerseCard 
                      text={verse.text} 
                      reference={verse.ref} 
                      version={verse.versionShortName} 
                    />
                  )}
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
