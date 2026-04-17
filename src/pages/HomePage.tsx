import { useState, useEffect } from "react";
import { Search, Loader2, Play, Heart, BookOpen, FileText, Megaphone } from "lucide-react";
import AIDevotional from "@/components/ai/AIDevotional";
import { useAIFeatures } from "@/hooks/useAIFeatures";
import StreakBadge from "@/components/StreakBadge";
import VerseCard from "@/components/VerseCard";
import CultoScheduleList from "@/components/CultoScheduleList";
import PrayerRequests from "@/components/PrayerRequests";
import { getDailyVerse } from "@/data/bible";
import { getRandomVerse } from "@/services/bibleApi";
import { useNavigate } from "react-router-dom";
import { useLocalStorage, type ReadingProgress, type StreakData, type DailyVerseEntry, getDisplayStreak } from "@/hooks/useLocalStorage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { readJsonStorage, writeJsonStorage } from "@/lib/localData";

type AdminPost = Database["public"]["Tables"]["admin_posts"]["Row"];

interface PlanProgress {
  planId: string;
  completedDays: number[];
  startedAt: string;
}

interface DBPlan {
  id: string;
  title: string;
  description: string;
  image_emoji: string;
  category: string;
  total_days: number | null;
}

const DAILY_VERSE_CACHE_KEY = "daily-verse-cache";
const DAILY_VERSE_CACHE_VERSION = 3; // Bump this to force all users to refresh

type CachedDailyVerse = {
  date: string;
  version?: number;
  source?: "manual" | "auto";
  verse: { text: string; ref: string };
};
const ADMIN_PLANS_CACHE_KEY = "cached-admin-plans";
const ADMIN_POSTS_CACHE_KEY = "cached-admin-posts";

const HomePage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
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
  const [planProgress] = useLocalStorage<PlanProgress[]>("plan-progress", []);

  // Daily verse
  const [verse, setVerse] = useState<{ text: string; ref: string } | null>(null);
  const [verseLoading, setVerseLoading] = useState(true);
  const [, setVerseHistory] = useLocalStorage<DailyVerseEntry[]>("daily-verse-history", []);

  // DB plans
  const [dbPlans, setDbPlans] = useState<DBPlan[]>(() => readJsonStorage<DBPlan[]>(ADMIN_PLANS_CACHE_KEY, []));
  const [adminPosts, setAdminPosts] = useState<AdminPost[]>(() => readJsonStorage<AdminPost[]>(ADMIN_POSTS_CACHE_KEY, []));

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
    const cached = readJsonStorage<{ date: string; version?: number; verse: { text: string; ref: string } } | null>(
      DAILY_VERSE_CACHE_KEY,
      null
    );

    // Invalidate stale or outdated-version cache
    if (cached && (cached.date !== today || (cached.version ?? 0) < DAILY_VERSE_CACHE_VERSION)) {
      localStorage.removeItem(DAILY_VERSE_CACHE_KEY);
    }

    if (cached?.date === today && (cached.version ?? 0) >= DAILY_VERSE_CACHE_VERSION && cached.verse?.text) {
      setVerse(cached.verse);
      setVerseLoading(false);
      setVerseHistory((prev) => {
        if (prev.some((e) => e.date === today)) return prev;
        return [{ date: today, ...cached.verse }, ...prev].slice(0, 90);
      });
      return;
    }

    if (!isOnline) {
      // Offline fallback
      setVerse(getDailyVerse());
      setVerseLoading(false);
      return;
    }

    setVerseLoading(true);

    // Try manual verse from queue first
    const tryManualVerse = async (): Promise<{ text: string; ref: string } | null> => {
      try {
        const { data: settings } = await supabase
          .from("admin_settings")
          .select("value")
          .eq("key", "daily_verse_mode")
          .single();
        const mode = settings?.value ? String(settings.value).replace(/"/g, "") : "auto";
        if (mode === "manual") {
          const { data: queueVerse } = await supabase
            .from("daily_verse_queue")
            .select("verse_text, verse_ref")
            .eq("scheduled_date", today)
            .single();
          if (queueVerse) {
            return { text: queueVerse.verse_text, ref: queueVerse.verse_ref };
          }
        }
      } catch { /* fall through to auto */ }
      return null;
    };

    tryManualVerse()
      .then(async (manualVerse) => {
        if (manualVerse) return manualVerse;
        try {
          const data = await getRandomVerse();
          if (data?.text) {
            return { text: data.text, ref: `${data.book.name} ${data.chapter}:${data.number}` };
          }
        } catch { /* fallback below */ }
        return getDailyVerse();
      })
      .then((v) => {
        setVerse(v);
        writeJsonStorage(DAILY_VERSE_CACHE_KEY, { date: today, version: DAILY_VERSE_CACHE_VERSION, verse: v }, false, "cache");
        setVerseHistory((prev) => {
          if (prev.some((e) => e.date === today)) return prev;
          return [{ date: today, ...v }, ...prev].slice(0, 90);
        });
      })
      .finally(() => setVerseLoading(false));
  }, [setVerseHistory]);

  // Fetch DB plans
  useEffect(() => {
    let cancelled = false;

    supabase
      .from("admin_plans")
      .select("id, title, description, image_emoji, category, total_days")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const nextPlans = data as unknown as DBPlan[];
        setDbPlans(nextPlans);
        writeJsonStorage(ADMIN_PLANS_CACHE_KEY, nextPlans, false, "cache");
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const getYoutubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
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

  // Enrolled plans = plans with progress
  const enrolledPlans = dbPlans.filter((p) =>
    planProgress.some((pp) => pp.planId === p.id && pp.completedDays.length > 0)
  );

  // Available plans (not yet enrolled) for discovery
  const availablePlans = dbPlans.filter((p) =>
    !planProgress.some((pp) => pp.planId === p.id && pp.completedDays.length > 0)
  );

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between">
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

      <div className="px-5 pt-6 space-y-6">
        {activeTab === "hoje" ? (
          <>
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
                <VerseCard text={verse.text} reference={verse.ref} />
              )}
              {!verseLoading && verse && (
                <AIDevotional verseRef={verse.ref} verseText={verse.text} enabled={aiFeatures.devotional} />
              )}
            </div>

            {/* Admin Posts Feed */}
            {adminPosts.length > 0 && (
              <div className="space-y-3">
                {adminPosts.map((post) => {
                  const Icon = postIcon(post.type);
                  const embedUrl = post.youtube_url ? getYoutubeEmbedUrl(post.youtube_url) : null;
                  return (
                    <div key={post.id} className="bg-[hsl(var(--dark-card))] rounded-2xl overflow-hidden">
                      {post.type === "video" && embedUrl && (
                        <div className="aspect-video">
                          <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            title={post.title}
                          />
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
                        <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed">{post.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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

            {/* Enrolled Plans (Seus Planos) */}
            {enrolledPlans.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                    Seus Planos
                  </h2>
                  <button onClick={() => navigate("/planos")} className="text-xs text-primary font-semibold">
                    Ver todos
                  </button>
                </div>
                {enrolledPlans.slice(0, 2).map((plan) => {
                  const prog = planProgress.find((p) => p.planId === plan.id);
                  const totalDays = plan.total_days || 1;
                  const pct = prog ? Math.round((prog.completedDays.length / totalDays) * 100) : 0;
                  return (
                    <button
                      key={plan.id}
                      onClick={() => {
                        writeJsonStorage("selected-plan", plan.id);
                        navigate("/planos");
                      }}
                      className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 mb-2 text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg">{plan.image_emoji}</span>
                        <p className="font-semibold text-sm flex-1">{plan.title}</p>
                        <span className="text-xs text-primary font-bold">{pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-[hsl(var(--dark-bg))] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Available Plans (Planos de Leitura) */}
            {availablePlans.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                    Planos de Leitura
                  </h2>
                  <button onClick={() => navigate("/planos")} className="text-xs text-primary font-semibold">
                    Ver todos
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
                  {availablePlans.slice(0, 4).map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => navigate("/planos")}
                      className="flex-shrink-0 w-36 bg-[hsl(var(--dark-card))] rounded-xl p-4 text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                    >
                      <span className="text-2xl mb-2 block">{plan.image_emoji}</span>
                      <p className="font-semibold text-xs leading-tight">{plan.title}</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">{plan.total_days || 0} dias</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6 pb-6">
            <CultoScheduleList />
            <PrayerRequests enabled={true} />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
