import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageHead from "@/components/PageHead";

/** Resolve o slug curto (/c/:slug) e abre a seleção de culto na Harpa. */
const CultoShareRedirect = () => {
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
      const { data, error: qerr } = await (supabase as any)
        .from("culto_selections")
        .select("id")
        .eq("share_slug", slug)
        .maybeSingle();
      if (cancelled) return;
      if (qerr || !data) {
        setError("Link não encontrado ou expirado.");
        return;
      }
      navigate(`/harpa/culto/${data.id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-[hsl(var(--dark-muted))]">
      <PageHead
        title="Seleção de hinos — Bíblia do Atalaia"
        description="Abra a seleção de hinos do culto na Harpa Atalaia."
        path={`/c/${slug ?? ""}`}
      />
      {error ? (
        <>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => navigate("/harpa")}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Abrir a Harpa
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <p className="text-sm">Abrindo seleção do culto…</p>
        </>
      )}
    </div>
  );
};

export default CultoShareRedirect;
