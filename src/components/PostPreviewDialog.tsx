import { BookOpen, Heart, Play, FileText, Megaphone, X } from "lucide-react";
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
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] p-0 gap-0 bg-[hsl(var(--dark-card))] border-white/10 overflow-hidden max-h-[92vh] flex flex-col">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-30 w-8 h-8 flex items-center justify-center rounded-full bg-black/60 backdrop-blur text-white hover:bg-black/80 transition"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {post.type === "video" && videoId ? (
          <div className="w-full">
            <BibleAtalaiaPlayer videoId={videoId} title={post.title} autoplay />
          </div>
        ) : null}

        <div className="p-5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </span>
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">
              {LABELS[post.type] || post.type}
            </span>
            {post.bible_reference && (
              <span className="text-[10px] text-[hsl(var(--dark-muted))] ml-auto font-semibold">
                {post.bible_reference}
              </span>
            )}
          </div>

          <DialogTitle className="text-lg font-bold text-[hsl(var(--dark-text))] leading-tight">
            {post.title}
          </DialogTitle>

          {post.content && (
            <DialogDescription asChild>
              <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--dark-text))]/85 whitespace-pre-wrap">
                {post.content}
              </p>
            </DialogDescription>
          )}

          {post.bible_reference && (
            <button
              type="button"
              onClick={goToReference}
              className="mt-5 w-full bg-primary text-primary-foreground font-bold text-sm py-3 rounded-xl active:scale-[0.98] transition"
            >
              Ler {post.bible_reference} na Bíblia
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostPreviewDialog;