import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";
import CronogramaCurso from "@/components/batismo/CronogramaCurso";
import { useBatismoConfig, useBatismoLicoes, useMinhaInscricao } from "@/hooks/useBatismo";
import {
  calcularMedia,
  dataLiberacaoLicao,
  estadoDaLicao,
  exercicioDaLicao,
  formatarDataBR,
  notaProvaValida,
  STATUS_LABELS,
} from "@/lib/batismo";
import {
  ArrowLeft,
  Award,
  CalendarHeart,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Lock,
  MessagesSquare,
  RotateCcw,
} from "lucide-react";

/** Trilha do aluno: lições, notas, prova final, recuperação e status. */
const BatismoCursoPage = () => {
  const navigate = useNavigate();
  const { config, loading: loadingConfig } = useBatismoConfig();
  const { licoes, loading: loadingLicoes } = useBatismoLicoes();
  const { inscricao, tentativas, certificado, loading: loadingInscricao } = useMinhaInscricao();

  const iniciadoEm = useMemo(
    () => (inscricao ? new Date(inscricao.iniciado_em) : new Date()),
    [inscricao],
  );

  const notasExercicios = useMemo(
    () =>
      tentativas
        .filter((t) => t.tipo === "exercicio" && t.status === "enviada" && t.nota !== null)
        .map((t) => Number(t.nota)),
    [tentativas],
  );
  const notaProva = useMemo(() => notaProvaValida(tentativas), [tentativas]);
  const media = useMemo(
    () => calcularMedia(notasExercicios, notaProva),
    [notasExercicios, notaProva],
  );

  const provaFeita = tentativas.some((t) => t.tipo === "prova_final" && t.status === "enviada");
  const todasLicoesFeitas =
    licoes.length > 0 && licoes.every((l) => exercicioDaLicao(tentativas, l.id));
  const podeProvaFinal = todasLicoesFeitas && !provaFeita;
  const podeRecuperacao =
    inscricao?.status === "reprovado" && inscricao.recuperacao_autorizada;

  if (loadingConfig || loadingLicoes || loadingInscricao) {
    return (
      <div className="pb-24 min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!inscricao) {
    return (
      <div className="pb-24 min-h-screen px-5 pt-16 max-w-2xl mx-auto text-center space-y-4">
        <p className="text-base font-semibold">Você ainda não se inscreveu no curso.</p>
        <Button onClick={() => navigate("/batismo/inscricao")} className="h-11">
          Fazer minha inscrição
        </Button>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title="Meu curso de batismo — Bíblia do Atalaia"
        description="Acompanhe suas lições, notas e o cronograma do Curso de Preparação para o Batismo."
        path="/batismo/curso"
      />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => navigate("/batismo")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">Meu curso de batismo</h1>
          <p className="text-xs text-[hsl(var(--dark-muted))] truncate">
            {inscricao.nome} · {STATUS_LABELS[inscricao.status]}
          </p>
        </div>
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-5">
        {/* Status / próximos passos */}
        {inscricao.status === "aprovado" && (
          <div className="rounded-2xl bg-green-500/10 border border-green-500/25 p-4 flex items-start gap-3">
            <MessagesSquare className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">Parabéns, você foi aprovado(a)!</p>
              <p className="text-[hsl(var(--dark-muted))]">
                O próximo passo é a conversa com o presbítero ou com o pastor. A liderança vai
                entrar em contato com você.
              </p>
            </div>
          </div>
        )}

        {inscricao.status === "reprovado" && !podeRecuperacao && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 p-4 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">Sua média ficou abaixo de {config?.media_minima ?? 6}.</p>
              <p className="text-[hsl(var(--dark-muted))]">
                Não desanime! Fale com a liderança para liberar sua prova de recuperação.
              </p>
            </div>
          </div>
        )}

        {inscricao.data_batismo && (
          <div className="rounded-2xl bg-primary/10 border border-primary/25 p-4 flex items-start gap-3">
            <CalendarHeart className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <p className="font-semibold">Seu batismo está marcado!</p>
              <p className="text-[hsl(var(--dark-muted))]">
                Data: {formatarDataBR(new Date(`${inscricao.data_batismo}T12:00:00`))}
              </p>
            </div>
          </div>
        )}

        {certificado?.pdf_path && (
          <Button
            onClick={() => navigate("/batismo/certificado")}
            className="w-full h-12 text-base"
          >
            <Award className="w-4 h-4 mr-2" />
            Baixar meu certificado
          </Button>
        )}

        {/* Notas */}
        <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Minhas notas</span>
            {media !== null && (
              <span
                className={`ml-auto text-sm font-bold ${
                  media >= (config?.media_minima ?? 6) ? "text-green-400" : "text-amber-500"
                }`}
              >
                Média: {media.toFixed(1).replace(".", ",")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {licoes.map((licao) => {
              const tent = exercicioDaLicao(tentativas, licao.id);
              return (
                <div
                  key={licao.id}
                  className="rounded-xl bg-[hsl(var(--dark-bg))] px-3 py-2 flex items-center justify-between"
                >
                  <span className="text-[hsl(var(--dark-muted))]">Lição {licao.ordem}</span>
                  <span className="font-semibold">
                    {tent?.nota !== null && tent?.nota !== undefined
                      ? Number(tent.nota).toFixed(1).replace(".", ",")
                      : "—"}
                  </span>
                </div>
              );
            })}
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 flex items-center justify-between col-span-2">
              <span className="text-[hsl(var(--dark-muted))]">Prova final</span>
              <span className="font-semibold">
                {notaProva !== null ? notaProva.toFixed(1).replace(".", ",") : "—"}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-[hsl(var(--dark-muted))] mt-2">
            Para aprovar, a média das 6 lições + prova final precisa ser{" "}
            {String(config?.media_minima ?? 6).replace(".", ",")} ou maior.
          </p>
        </div>

        {/* Trilha de lições */}
        <div className="space-y-2">
          {licoes.map((licao) => {
            const estado = estadoDaLicao(
              licao,
              licoes,
              tentativas,
              iniciadoEm,
              config?.intervalo_liberacao_horas ?? 24,
            );
            const tent = exercicioDaLicao(tentativas, licao.id);
            const dataLib = dataLiberacaoLicao(
              iniciadoEm,
              licao.ordem,
              config?.intervalo_liberacao_horas ?? 24,
            );
            const clicavel = estado === "liberada" || estado === "concluida";
            return (
              <button
                key={licao.id}
                disabled={!clicavel}
                onClick={() => navigate(`/batismo/licao/${licao.ordem}`)}
                className={`w-full flex items-center gap-3 rounded-2xl p-4 text-left transition-colors ${
                  estado === "concluida"
                    ? "bg-green-500/10 border border-green-500/20"
                    : estado === "liberada"
                      ? "bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))]"
                      : "bg-[hsl(var(--dark-card))] opacity-60"
                }`}
              >
                {estado === "concluida" ? (
                  <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                ) : estado === "liberada" ? (
                  <span className="w-5 h-5 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] font-bold">
                    {licao.ordem}
                  </span>
                ) : (
                  <Lock className="w-5 h-5 text-[hsl(var(--dark-muted))] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    Lição {licao.ordem} — {licao.titulo}
                  </p>
                  <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                    {estado === "concluida"
                      ? `Concluída · nota ${Number(tent?.nota ?? 0).toFixed(1).replace(".", ",")}`
                      : estado === "liberada"
                        ? "Liberada — toque para estudar"
                        : estado === "aguardando_data"
                          ? `Libera em ${formatarDataBR(dataLib)}`
                          : "Conclua a lição anterior"}
                  </p>
                </div>
                {clicavel && <span className="text-xs text-[hsl(var(--dark-muted))]">→</span>}
              </button>
            );
          })}
        </div>

        {/* Prova final / recuperação */}
        {podeProvaFinal && (
          <Button
            onClick={() => navigate("/batismo/prova-final")}
            className="w-full h-12 text-base"
          >
            Fazer a prova final
          </Button>
        )}
        {podeRecuperacao && (
          <Button
            onClick={() => navigate("/batismo/prova-final?tipo=recuperacao")}
            className="w-full h-12 text-base"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Fazer a prova de recuperação
          </Button>
        )}

        {config && (
          <CronogramaCurso
            licoes={licoes}
            iniciadoEm={iniciadoEm}
            intervaloHoras={config.intervalo_liberacao_horas}
            tentativas={tentativas}
          />
        )}
      </div>
    </div>
  );
};

export default BatismoCursoPage;
