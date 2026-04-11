import { useState, useEffect } from "react";
import { Search, Bell, Loader2, Play, Heart, BookOpen, FileText, Megaphone } from "lucide-react";
import StreakBadge from "@/components/StreakBadge";
import VerseCard from "@/components/VerseCard";
import { getDailyVerse, readingPlans, bibleBooks } from "@/data/bible";
import { getRandomVerse } from "@/services/bibleApi";
import { useNavigate } from "react-router-dom";
import { useLocalStorage, type ReadingProgress, type StreakData } from "@/hooks/useLocalStorage";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AdminPost = Database["public"]["Tables"]["admin_posts"]["Row"];

const HomePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"hoje" | "comunidade">("hoje");
  const [streak] = useLocalStorage<StreakData>("streak", { current: 0, lastDate: "", history: [] });
  const [progress] = useLocalStorage<ReadingProgress | null>("reading-progress", null);

  // Daily verse - fetch from API, cache for the day
  const fallback = getDailyVerse();
  const [verse, setVerse] = useState<{ text: string; ref: string }>(fallback);
  const [verseLoading, setVerseLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    // Check localStorage cache
    try {
      const cached = localStorage.getItem("daily-verse-cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.date === today && parsed.verse?.text) {
          setVerse(parsed.verse);
          setVerseLoading(false);
          return;
        }
      }
    } catch {}

    // Fetch fresh verse
    setVerseLoading(true);
    getRandomVerse()
      .then((data) => {
        if (data?.text) {
          const v = {
            text: data.text,
            ref: `${data.book.name} ${data.chapter}:${data.number}`,
          };
          setVerse(v);
          localStorage.setItem("daily-verse-cache", JSON.stringify({ date: today, verse: v }));
        }
      })
      .catch(() => {
        // Use fallback silently
      })
      .finally(() => setVerseLoading(false));
  }, []);

  // Fetch admin posts from database
  const [adminPosts, setAdminPosts] = useState<AdminPost[]>([]);
  useEffect(() => {
    supabase
      .from("admin_posts")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setAdminPosts(data);
      });
  }, []);

  // Navigate to continue reading with correct book/chapter
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

  return (
    <div className="pb-20 min-h-screen">
      {/* Header */}
      <header className="px-5 pt-12 pb-4 flex items-center justify-between">
        <StreakBadge days={streak.current} />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/descubra")}
            className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center"
          >
            <Search className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
          <button className="w-9 h-9 rounded-full bg-[hsl(var(--dark-card))] flex items-center justify-center">
            <Bell className="w-4 h-4 text-[hsl(var(--dark-muted))]" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 flex gap-6 border-b border-[hsl(var(--dark-card))]">
        {(["hoje", "comunidade"] as const).map((tab) => (
          <button
            key={tab}
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
              <h1 className="text-2xl font-bold">Olá! 👋</h1>
              <p className="text-[hsl(var(--dark-muted))] text-sm mt-1">
                {streak.current > 0
                  ? `Você está numa ofensiva de ${streak.current} dia${streak.current > 1 ? "s" : ""}!`
                  : "Comece sua leitura de hoje!"}
              </p>
            </div>

            {/* Verse of the Day */}
            <div>
              <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider mb-3">
                Versículo do dia
              </h2>
              {verseLoading ? (
                <div className="bg-gradient-to-br from-[hsl(220,70%,50%)] to-[hsl(260,60%,45%)] rounded-2xl p-6 flex items-center justify-center h-40">
                  <Loader2 className="w-6 h-6 animate-spin text-white" />
                </div>
              ) : (
                <VerseCard text={verse.text} reference={verse.ref} />
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
                      {/* YouTube embed */}
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


            <div>
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

            {/* Active Plans Progress */}
            {(() => {
              try {
                const planProgressData = JSON.parse(localStorage.getItem("plan-progress") || "[]");
                const activePlans = planProgressData.filter((p: { completedDays: number[] }) => p.completedDays.length > 0);
                if (activePlans.length === 0) return null;
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                        Seus Planos
                      </h2>
                      <button onClick={() => navigate("/planos")} className="text-xs text-primary font-semibold">
                        Ver todos
                      </button>
                    </div>
                    {activePlans.slice(0, 2).map((prog: { planId: string; completedDays: number[] }) => {
                      const plan = readingPlans.find((p) => p.id === prog.planId);
                      if (!plan) return null;
                      const pct = Math.round((prog.completedDays.length / plan.readings.length) * 100);
                      return (
                        <button
                          key={plan.id}
                          onClick={() => {
                            localStorage.setItem("selected-plan", JSON.stringify(plan.id));
                            navigate("/planos");
                          }}
                          className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 mb-2 text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg">{plan.image}</span>
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
                );
              } catch { return null; }
            })()}

            {/* Reading Plans */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase tracking-wider">
                  Planos de Leitura
                </h2>
                <button
                  onClick={() => navigate("/planos")}
                  className="text-xs text-primary font-semibold"
                >
                  Ver todos
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5">
                {readingPlans.slice(0, 4).map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => navigate("/planos")}
                    className="flex-shrink-0 w-36 bg-[hsl(var(--dark-card))] rounded-xl p-4 text-left active:bg-[hsl(var(--dark-card-hover))] transition-colors"
                  >
                    <span className="text-2xl mb-2 block">{plan.image}</span>
                    <p className="font-semibold text-xs leading-tight">{plan.title}</p>
                    <p className="text-[10px] text-[hsl(var(--dark-muted))] mt-1">{plan.readings.length} leituras</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">🤝</p>
            <h2 className="text-lg font-bold mb-2">Comunidade</h2>
            <p className="text-sm text-[hsl(var(--dark-muted))] max-w-xs mx-auto">
              Em breve você poderá compartilhar versículos e devocionais com amigos.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
