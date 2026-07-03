import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit2, Save, X, Eye, EyeOff, FileText, Video, BookOpen, Heart, Megaphone, Play } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import PostPreviewDialog from "@/components/PostPreviewDialog";

type Post = Database["public"]["Tables"]["admin_posts"]["Row"];

const POST_TYPES = [
  { value: "versiculo", label: "Versículo", icon: BookOpen },
  { value: "oracao", label: "Oração", icon: Heart },
  { value: "video", label: "Vídeo YouTube", icon: Video },
  { value: "devocional", label: "Devocional", icon: FileText },
  { value: "anuncio", label: "Anúncio", icon: Megaphone },
];

const POST_PUSH_TTL_SECONDS = 60 * 60 * 24;

interface AdminPostsProps {
  posts: Post[];
  fetchData: () => void;
}

const AdminPosts = ({ posts, fetchData }: AdminPostsProps) => {
  const [editingPost, setEditingPost] = useState<Partial<Post> | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  const sendPostPush = async (postData: Pick<Post, "title" | "content" | "type">) => {
    const postTypeLabel = POST_TYPES.find((t) => t.value === postData.type)?.label || "Post";

    await supabase.functions.invoke("send-push", {
      body: {
        title: `📢 ${postTypeLabel}: ${postData.title.substring(0, 60)}`,
        body: postData.content.substring(0, 120) + (postData.content.length > 120 ? "..." : ""),
        url: "/",
        ttl: POST_PUSH_TTL_SECONDS,
        urgency: "high",
        type: "post",
      },
    });
  };

  const savePost = async () => {
    if (!editingPost?.title?.trim()) {
      toast.error("O título é obrigatório");
      return;
    }
    const isVideo = (editingPost.type || "devocional") === "video";
    if (isVideo) {
      if (!editingPost.youtube_url?.trim()) {
        toast.error("Informe a URL do YouTube");
        return;
      }
    } else if (!editingPost?.content?.trim()) {
      toast.error("O conteúdo é obrigatório");
      return;
    }
    const data = {
      title: editingPost.title.trim(),
      content: editingPost.content?.trim() || (isVideo ? editingPost.title.trim() : ""),
      type: editingPost.type || "devocional",
      youtube_url: editingPost.youtube_url?.trim() || null,
      bible_reference: editingPost.bible_reference?.trim() || null,
      image_url: editingPost.image_url?.trim() || null,
      is_active: editingPost.is_active ?? true,
      sort_order: editingPost.sort_order ?? 0,
    };
    const isNew = !editingPost.id;
    if (editingPost.id) {
      const { error } = await supabase.from("admin_posts").update(data).eq("id", editingPost.id);
      if (error) {
        console.error("Erro ao salvar post:", error);
        toast.error(`Erro ao salvar: ${error.message}`);
        return;
      }
      toast.success("Postagem atualizada!");
    } else {
      const { error } = await supabase.from("admin_posts").insert(data);
      if (error) {
        console.error("Erro ao criar post:", error);
        toast.error(`Erro ao criar: ${error.message}`);
        return;
      }
      toast.success("Postagem criada!");
    }
    if (isNew && data.is_active) {
      try {
        await sendPostPush(data);
        toast.success("Notificação push enviada automaticamente!");
      } catch (e) {
        console.error("Push auto-send error:", e);
        toast.error("Post criado, mas falha ao enviar push");
      }
    }
    setEditingPost(null);
    fetchData();
  };

  const deletePost = async (id: string) => {
    const { error } = await supabase.from("admin_posts").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Postagem excluída");
    fetchData();
  };

  const togglePostActive = async (post: Post) => {
    const nextIsActive = !post.is_active;
    const { error } = await supabase.from("admin_posts").update({ is_active: nextIsActive }).eq("id", post.id);
    if (error) {
      toast.error("Erro ao atualizar visibilidade");
      return;
    }
    if (!post.is_active && nextIsActive) {
      try {
        await sendPostPush(post);
        toast.success("Aviso exibido novamente e push enviado!");
      } catch (e) {
        console.error("Push resend error:", e);
        toast.error("Aviso exibido, mas falha ao reenviar push");
      }
    } else {
      toast.success("Visibilidade do aviso atualizada!");
    }
    fetchData();
  };

  if (editingPost) {
    return (
      <div className="min-h-screen pb-10">
        <header className="px-5 pt-8 pb-4 flex items-center gap-3 border-b border-[hsl(var(--dark-card))]">
          <button onClick={() => setEditingPost(null)}><X className="w-5 h-5" /></button>
          <h1 className="text-lg font-bold flex-1">{editingPost.id ? "Editar" : "Nova"} Postagem</h1>
          <Button size="sm" onClick={savePost}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
        </header>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Tipo</label>
            <div className="flex flex-wrap gap-2">
              {POST_TYPES.map((t) => (
                <button key={t.value} onClick={() => setEditingPost({ ...editingPost, type: t.value })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    editingPost.type === t.value ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))]"
                  }`}>
                  <t.icon className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Título</label>
            <Input value={editingPost.title || ""} onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
              className="bg-[hsl(var(--dark-card))] border-none" maxLength={200} />
          </div>
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Conteúdo</label>
            <Textarea value={editingPost.content || ""} onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
              className="bg-[hsl(var(--dark-card))] border-none min-h-[120px]" maxLength={5000} />
          </div>
          {editingPost.type === "video" && (
            <div>
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">URL do YouTube</label>
              <Input value={editingPost.youtube_url || ""} onChange={(e) => setEditingPost({ ...editingPost, youtube_url: e.target.value })}
                placeholder="https://youtube.com/watch?v=..." className="bg-[hsl(var(--dark-card))] border-none" maxLength={500} />
            </div>
          )}
          {(editingPost.type === "versiculo" || editingPost.type === "oracao") && (
            <div>
              <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Referência Bíblica</label>
              <Input value={editingPost.bible_reference || ""} onChange={(e) => setEditingPost({ ...editingPost, bible_reference: e.target.value })}
                placeholder="Ex: João 3:16" className="bg-[hsl(var(--dark-card))] border-none" maxLength={100} />
            </div>
          )}
          <div>
            <label className="text-xs text-[hsl(var(--dark-muted))] mb-1 block">Ordem de exibição</label>
            <Input type="number" value={editingPost.sort_order ?? 0}
              onChange={(e) => setEditingPost({ ...editingPost, sort_order: parseInt(e.target.value) || 0 })}
              className="bg-[hsl(var(--dark-card))] border-none w-24" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setEditingPost({ type: "devocional", is_active: true, sort_order: 0 })} className="w-full mb-4">
        <Plus className="w-4 h-4 mr-2" /> Nova Postagem
      </Button>
      <div className="space-y-2">
        {posts.map((post) => {
          const typeInfo = POST_TYPES.find((t) => t.value === post.type);
          const Icon = typeInfo?.icon || FileText;
          const ytMatch = post.youtube_url?.match(/(?:v=|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          const ytId = ytMatch ? ytMatch[1] : null;
          return (
            <div key={post.id} className="bg-[hsl(var(--dark-card))] rounded-xl p-4">
              <button
                type="button"
                onClick={() => setPreviewPost(post)}
                className="w-full flex items-start gap-3 text-left active:opacity-80 transition"
                aria-label={`Visualizar ${post.title}`}
              >
                {ytId ? (
                  <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-black">
                    <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="w-5 h-5 text-white fill-current" />
                    </span>
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{post.title}</p>
                    {!post.is_active && <span className="text-[10px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">Oculto</span>}
                  </div>
                  <p className="text-xs text-[hsl(var(--dark-muted))] mt-0.5 line-clamp-2">{post.content}</p>
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-primary/80 uppercase tracking-wider">
                    <Eye className="w-3 h-3" /> Ver preview
                  </span>
                </div>
              </button>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card))]">
                <button onClick={() => setEditingPost(post)} className="text-xs text-primary font-medium flex items-center gap-1">
                  <Edit2 className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => togglePostActive(post)} className="text-xs text-[hsl(var(--dark-muted))] font-medium flex items-center gap-1 ml-auto">
                  {post.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {post.is_active ? "Ocultar" : "Mostrar"}
                </button>
                <button onClick={() => deletePost(post.id)} className="text-xs text-destructive font-medium flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            </div>
          );
        })}
        {posts.length === 0 && <p className="text-sm text-[hsl(var(--dark-muted))] text-center py-10">Nenhuma postagem ainda</p>}
      </div>
      <PostPreviewDialog post={previewPost} open={!!previewPost} onOpenChange={(o) => !o && setPreviewPost(null)} />
    </>
  );
};

export default AdminPosts;