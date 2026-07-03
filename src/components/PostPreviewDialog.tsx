import { BookOpen, Heart, Play, FileText, Megaphone, X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BibleAtalaiaPlayer from "@/components/BibleAtalaiaPlayer";

type AdminPost = Database["public"]["Tables"]["admin_posts"]["Row"];

const LABELS: Record<string, string> = {
  versiculo: "Versículo",
  oracao: "Oração",
  video: "Vídeo",
  devocional: "Devocional",
  anuncio: "Anúncio",
};

function iconFor(type: string) {
  switch (type) {
    case "versiculo": return BookOpen;
    case "oracao": return Heart;
    case "video": return Play;
    case "anuncio": return Megaphone;
    default: return FileText;
  }
}

function extractYoutubeId(url: string) {
  const m = url.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

interface Props {
  post: AdminPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PostPreviewDialog = ({ post, open, onOpenChange }: Props) => {
  const navigate = useNavigate();
  if (!post) return null;

  const Icon = iconFor(post.type);
  const videoId = post.youtube_url ? extractYoutubeId(post.youtube_url) : null;

  const goToReference = () => {
    if (!post.bible_reference) return;
    const params = new URLSearchParams({
      book: post.bible_reference.split(" ")[0].toLowerCase(),
      chapter: post.bible_reference.split(" ")[1]?.split(":")[0] || "1",
    });
    onOpenChange(false);
    navigate(`/biblia?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl w-[calc(100vw-1rem)] p-0 gap-0 border border-white/10 overflow-hidden max-h-[94vh] flex flex-col rounded-2xl shadow-[0_25px_80px_-15px_rgba(0,0,0,0.75)] bg-gradient-to-b from-[hsl(var(--dark-card-hover))] to-[hsl(var(--dark-card))]"
      >
        {/* Close */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-30 w-9 h-9 flex items-center justify-center rounded-full bg-black/55 backdrop-blur-md text-white hover:bg-black/75 active:scale-95 transition ring-1 ring-white/10"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {post.type === "video" && videoId ? (
          <div className="w-full bg-black">
            {/* Player fills the top with no rounding underneath so it reads as one surface */}
            <div className="[&>div]:rounded-none [&>div]:rounded-t-2xl overflow-hidden">
              <BibleAtalaiaPlayer videoId={videoId} title={post.title} autoplay />
            </div>
          </div>
        ) : (
          // Decorative header for non-video posts
          <div className="relative h-24 bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border-b border-white/5 flex items-end p-5">
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.35),transparent_55%)]" />
            <span className="relative w-12 h-12 rounded-2xl bg-primary/90 flex items-center justify-center shadow-lg ring-4 ring-primary/20">
              <Icon className="w-5 h-5 text-primary-foreground" />
            </span>
          </div>
        )}

        <div className="p-5 sm:p-6 overflow-y-auto">
          {/* Meta row */}
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {LABELS[post.type] || post.type}
              </span>
            </span>
            {post.bible_reference && (
              <span className="ml-auto text-[11px] font-semibold text-[hsl(var(--dark-muted))] bg-white/5 px-2 py-1 rounded-md">
                {post.bible_reference}
              </span>
            )}
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-bold text-[hsl(var(--dark-text))] leading-tight tracking-tight">
            {post.title}
          </DialogTitle>

          {post.content && (
            <DialogDescription asChild>
              <p className="mt-3 text-[15px] leading-relaxed text-[hsl(var(--dark-text))]/85 whitespace-pre-wrap">
                {post.content}
              </p>
            </DialogDescription>
          )}

          {post.bible_reference && (
            <button
              type="button"
              onClick={goToReference}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm py-3.5 rounded-2xl active:scale-[0.98] transition shadow-lg shadow-primary/30"
            >
              <BookOpen className="w-4 h-4" />
              Ler {post.bible_reference} na Bíblia
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostPreviewDialog;