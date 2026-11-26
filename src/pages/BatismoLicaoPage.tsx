import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";
import { useBatismoConfig, useBatismoLicoes, useMinhaInscricao } from "@/hooks/useBatismo";
import {
  dataLiberacaoLicao,
  estadoDaLicao,
  exercicioDaLicao,
  formatarDataBR,
} from "@/lib/batismo";
import { bibleUrlFromReference } from "@/lib/bibleNav";
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, Lock, Sparkles } from "lucide-react";

/** Tela de leitura de uma lição do curso. */
const BatismoLicaoPage = () => {
  const navigate = useNavigate();
  const { ordem: ordemParam } = useParams<{ ordem: string }>();
  const ordem = Number(ordemParam || 0);
  const { config } = useBatismoConfig();
  const { licoes, loading: loadingLicoes } = useBatismoLicoes();
  const { inscricao, tentativas, loading: loadingInscricao } = useMinhaInscricao();

  const licao = useMemo(() => licoes.find((l) => l.ordem === ordem), [licoes, ordem]);

  const estado = useMemo(() => {
    if (!licao || !inscricao || !config) return null;
    return estadoDaLicao(
      licao,
      licoes,
      tentativas,
      new Date(inscricao.iniciado_em),
      config.intervalo_liberacao_horas,
    );
  }, [licao, licoes, tentativas, inscricao, config]);

  if (loadingLicoes || loadingInscricao) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!inscricao) {
    return (
      <div className="pb-24 min-h-screen px-5 pt-16 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-base font-semibold">Faça sua inscrição para acessar as lições.</p>
        <Button onClick={() => navigate("/batismo/inscricao")} className="h-11">
          Fazer minha inscrição
        </Button>
      </div>
    );
  }

  if (!licao) {
    return (
      <div className="pb-24 min-h-screen px-5 pt-16 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-base font-semibold">Lição não encontrada.</p>
        <Button onClick={() => navigate("/batismo/curso")} className="h-11">
          Voltar ao curso
        </Button>
      </div>
    );
  }

  const bloqueada = estado === "aguardando_data" || estado === "aguardando_anterior";
  const concluida = estado === "concluida";
  const tent = exercicioDaLicao(tentativas, licao.id);
  const urlVersiculo = bibleUrlFromReference(licao.versiculo_referencia);

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title={`Lição ${licao.ordem} — ${licao.titulo} | Batismo`}
        description={licao.objetivo}
        path={`/batismo/licao/${licao.ordem}`}
      />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => navigate("/batismo/curso")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-widest text-amber-700 dark:text-amber-400/90 font-semibold">
            Lição {licao.ordem} de {licoes.length}
          </p>
          <h1 className="text-xl font-bold leading-tight truncate">{licao.titulo}</h1>
        </div>
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-5">
        {bloqueada ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 text-center space-y-3">
            <Lock className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))]" />
            <p className="text-base font-semibold">Esta lição ainda não está liberada</p>
            <p className="text-sm text-[hsl(var(--dark-muted))]">
              {estado === "aguardando_data" && config
                ? `Ela libera em ${formatarDataBR(
                    dataLiberacaoLicao(
                      new Date(inscricao.iniciado_em),
                      licao.ordem,
                      config.intervalo_liberacao_horas,
                    ),
                  )}. Uma lição por dia, para você meditar com calma.`
                : "Conclua a lição anterior para liberar esta."}
            </p>
            <Button onClick={() => navigate("/batismo/curso")} variant="secondary">
              Voltar ao curso
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
              <p className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-1">
                Objetivo da lição
              </p>
              <p className="text-sm leading-relaxed">{licao.objetivo}</p>
            </div>

            <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-p:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {licao.conteudo}
              </ReactMarkdown>
            </article>

            {/* Versículo-chave */}
            <div className="bg-gradient-to-br from-amber-50 via-[#fdf8ec] to-amber-100/80 dark:from-[hsl(220,25%,11%)] dark:via-[hsl(225,28%,13%)] dark:to-[hsl(40,55%,19%)] rounded-2xl p-5 border border-amber-600/25 dark:border-amber-400/20 space-y-3">
              <p className="text-[11px] uppercase tracking-widest text-amber-700 dark:text-amber-400/90 font-semibold">
                Versículo-chave
              </p>
              <p className="text-base leading-relaxed italic">"{licao.versiculo_chave}"</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">{licao.versiculo_referencia} (NVI)</span>
                {urlVersiculo && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(urlVersiculo)}
                  >
                    <BookOpen className="w-4 h-4 mr-1.5" />
                    Abrir na Bíblia
                  </Button>
                )}
              </div>
            </div>

            {/* Referências de apoio */}
            {licao.referencias.length > 0 && (
              <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-4 space-y-2">
                <p className="text-[11px] uppercase tracking-widest text-[hsl(var(--dark-muted))] font-semibold">
                  Para ler também
                </p>
                {licao.referencias.map((ref, idx) => {
                  const url = bibleUrlFromReference(ref.referencia);
                  return (
                    <button
                      key={idx}
                      onClick={() => url && navigate(url)}
                      className="w-full text-left rounded-xl bg-[hsl(var(--dark-bg))] px-3 py-2.5 hover:border-primary/40 border border-transparent transition-colors"
                    >
                      <span className="text-sm font-semibold text-primary">{ref.referencia}</span>
                      <span className="block text-xs text-[hsl(var(--dark-muted))] mt-0.5 leading-relaxed">
                        {ref.texto}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Frase para guardar */}
            <div className="rounded-2xl bg-[hsl(var(--dark-card))] p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[11px] uppercase tracking-widest text-[hsl(var(--dark-muted))] font-semibold mb-1">
                  Frase para guardar
                </p>
                <p className="text-base font-semibold leading-relaxed">
                  "{licao.frase_para_guardar}"
                </p>
              </div>
            </div>

            {concluida ? (
              <div className="rounded-2xl bg-green-500/10 border border-green-500/25 p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <p className="text-sm">
                  Exercício concluído · nota{" "}
                  <strong>{Number(tent?.nota ?? 0).toFixed(1).replace(".", ",")}</strong>
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  className="ml-auto"
                  onClick={() => navigate("/batismo/curso")}
                >
                  Voltar ao curso
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => navigate(`/batismo/exercicio/${licao.ordem}`)}
                className="w-full h-12 text-base"
              >
                Fazer o exercício da lição
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BatismoLicaoPage;
