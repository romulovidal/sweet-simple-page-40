import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageHead from "@/components/PageHead";

/**
 * Resolve um slug curto (/v/:slug) em uma URL /biblia?book&chapter&verses
 * e redireciona automaticamente.
 */
const VerseShareRedirect = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Link inválido.");
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error: qerr } = await supabase
        .from("verse_shares")
        .select("book_abbrev, chapter, verses, text_snippet, book_name, version")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) return;

      if (qerr || !data) {
        setError("Link não encontrado ou expirado.");
        return;
      }

      const verses = (data.verses ?? []) as number[];
      const versesParam = verses.join(",");
      const firstVerse = verses.length ? Math.min(...verses) : null;
      const params = new URLSearchParams({
        book: data.book_abbrev,
        chapter: String(data.chapter),
      });
      if (firstVerse) params.set("verse", String(firstVerse));
      if (versesParam) params.set("verses", versesParam);
      navigate(
        `/biblia?${params.toString()}`,
        { replace: true },
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <PageHead
        title={data ? `${data.book_name} ${data.chapter}:${(data.verses as number[]).join(",")} — A Bíblia do Atalaia` : "Abrindo versículo — A Bíblia do Atalaia"}
        description={data?.text_snippet || "Carregando versículo compartilhado."}
        image={`https://hvdmobypsqksgkfrzhzf.supabase.co/functions/v1/og/${slug}.png`}
        path={`/v/${slug ?? ""}`}
        noindex={!data}
      />
      {error ? (
        <>
          <p className="text-sm text-destructive font-semibold">{error}</p>
          <button
            onClick={() => navigate("/biblia", { replace: true })}
            className="text-sm text-primary underline"
          >
            Ir para a Bíblia
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-dark-muted">Abrindo versículo…</p>
        </>
      )}
    </div>
  );
};

export default VerseShareRedirect;