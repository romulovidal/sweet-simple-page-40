import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";
import Cronometro from "@/components/batismo/Cronometro";
import QuestaoCard from "@/components/batismo/QuestaoCard";
import RegrasTentativa from "@/components/batismo/RegrasTentativa";
import { useBatismoConfig, useBatismoLicoes, useMinhaInscricao } from "@/hooks/useBatismo";
import {
  batismoDb,
  notificarAdminsBatismo,
  type BatismoQuestaoSorteada,
  type BatismoTentativa,
  type BatismoTentativaTipo,
} from "@/lib/batismo";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Loader2, Lock, Send } from "lucide-react";

interface ResultadoEnvio {
  nota: number;
  acertos: number;
  total: number;
  media: number | null;
  status_inscricao: string;
}

const MENSAGENS_ERRO: Record<string, string> = {
  TERMOS_NAO_ACEITOS: "É preciso aceitar os termos para começar.",
  LICAO_NAO_LIBERADA: "Esta lição ainda não foi liberada. Aguarde a data do cronograma.",
  LICAO_ANTERIOR_PENDENTE: "Conclua a lição anterior antes de fazer este exercício.",
  TENTATIVA_JA_ENVIADA: "Esta tentativa já foi enviada e está travada.",
  TEMPO_ESGOTADO: "O tempo esgotou e a tentativa foi fechada.",
  EXERCICIOS_PENDENTES: "Conclua os exercícios de todas as lições antes da prova final.",
  RECUPERACAO_NAO_AUTORIZADA: "A recuperação ainda não foi liberada pela liderança.",
  SEM_QUESTOES_NO_BANCO: "Ainda não há questões cadastradas. Fale com a liderança.",
  INSCRICAO_INVALIDA: "Inscrição não encontrada.",
  TENTATIVA_INVALIDA: "Tentativa não encontrada.",
  LICAO_INVALIDA: "Lição não encontrada.",
  TIPO_INVALIDO: "Tipo de prova inválido.",
};

function mensagemErro(err: unknown): string {
  const msg = String((err as { message?: string })?.message || "");
  for (const [codigo, texto] of Object.entries(MENSAGENS_ERRO)) {
    if (msg.includes(codigo)) return texto;
  }
  return "Algo deu errado. Tente novamente.";
}

/**
 * Tela de tentativa: exercício da lição, prova final ou recuperação.
 * Fluxo: regras + aceite → sorteio no servidor → cronômetro →
 * envio (automático ao zerar) → resultado travado.
 */
const BatismoTentativaPage = ({ modo }: { modo: "exercicio" | "prova" }) => {
  const navigate = useNavigate();
  const { ordem: ordemParam } = useParams<{ ordem: string }>();
  const [searchParams] = useSearchParams();
  const { config } = useBatismoConfig();
  const { licoes } = useBatismoLicoes();
  const { inscricao, tentativas, recarregar } = useMinhaInscricao();

  const tipo: BatismoTentativaTipo =
    modo === "exercicio"
      ? "exercicio"
      : searchParams.get("tipo") === "recuperacao"
        ? "recuperacao"
        : "prova_final";

  const licao = useMemo(
    () => (modo === "exercicio" ? licoes.find((l) => l.ordem === Number(ordemParam || 0)) : undefined),
    [licoes, modo, ordemParam],
  );

  const [fase, setFase] = useState<"regras" | "respondendo" | "resultado">("regras");
  const [tentativaId, setTentativaId] = useState<string | null>(null);
  const [prazoEm, setPrazoEm] = useState<string | null>(null);
  const [questoes, setQuestoes] = useState<BatismoQuestaoSorteada[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [comecando, setComecando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoEnvio | null>(null);
  const enviandoRef = useRef(false);

  const tentativaEnviada: BatismoTentativa | undefined = useMemo(
    () =>
      tentativas.find(
        (t) =>
          t.tipo === tipo &&
          t.status === "enviada" &&
          (modo === "prova" || t.licao_id === licao?.id),
      ),
    [tentativas, tipo, modo, licao],
  );

  const quantidade = modo === "exercicio" ? config?.questoes_por_exercicio ?? 5 : config?.questoes_prova_final ?? 10;
  const tempoMin = modo === "exercicio" ? config?.tempo_exercicio_min ?? 40 : config?.tempo_prova_final_min ?? 60;
  const titulo =
    modo === "exercicio"
      ? `Exercício — Lição ${licao?.ordem ?? ""}`
      : tipo === "recuperacao"
        ? "Prova de Recuperação"
        : "Prova Final";

  const comecar = useCallback(async () => {
    if (!inscricao) return;
    setComecando(true);
    try {
      const { data, error } = await batismoDb().rpc("batismo_iniciar_tentativa", {
        p_inscricao_id: inscricao.id,
        p_tipo: tipo,
        p_licao_id: modo === "exercicio" ? licao?.id ?? null : null,
        p_termos_aceitos: true,
      });
      if (error) throw error;
      setTentativaId(data.tentativa_id);
      setPrazoEm(data.prazo_em);
      setQuestoes((data.questoes as BatismoQuestaoSorteada[]) || []);
      setFase("respondendo");
    } catch (err) {
      toast.error(mensagemErro(err));
      void recarregar();
    } finally {
      setComecando(false);
    }
  }, [inscricao, tipo, modo, licao, recarregar]);

  const enviar = useCallback(
    async (automatico = false) => {
      if (!tentativaId || enviandoRef.current) return;
      enviandoRef.current = true;
      setEnviando(true);
      try {
        const lista = Object.entries(respostas).map(([codigo, resposta]) => ({
          codigo,
          resposta,
        }));
        const { data, error } = await batismoDb().rpc("batismo_enviar_tentativa", {
          p_tentativa_id: tentativaId,
          p_respostas: lista,
        });
        if (error) throw error;
        const res = data as ResultadoEnvio;
        setResultado(res);
        setFase("resultado");
        if (automatico) toast.warning("Tempo esgotado — respostas enviadas automaticamente.");
        else toast.success("Respostas enviadas!");
        if (inscricao) {
          if (res.status_inscricao === "aprovado") {
            void notificarAdminsBatismo("aprovado", inscricao.id);
          } else if (res.status_inscricao === "reprovado") {
            void notificarAdminsBatismo("recuperacao_pendente", inscricao.id);
          }
        }
        void recarregar();
      } catch (err) {
        toast.error(mensagemErro(err));
        void recarregar();
      } finally {
        setEnviando(false);
        enviandoRef.current = false;
      }
    },
    [tentativaId, respostas, inscricao, recarregar],
  );

  const respondidas = Object.keys(respostas).length;

  // Já enviada: mostra o resultado travado
  const mostrarTravado = fase !== "resultado" && tentativaEnviada && fase === "regras";

  return (
    <div className="pb-24 min-h-screen">
      <PageHead title={`${titulo} | Batismo`} description="Exercício do Curso de Preparação para o Batismo." path={modo === "exercicio" ? `/batismo/exercicio/${ordemParam}` : "/batismo/prova-final"} />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto flex items-center gap-3">
        <button
          onClick={() => navigate("/batismo/curso")}
          aria-label="Voltar"
          className="w-10 h-10 rounded-2xl grid place-items-center bg-[hsl(var(--dark-card))] hover:bg-[hsl(var(--dark-card-hover))] shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold leading-tight truncate">{titulo}</h1>
          {modo === "exercicio" && licao && (
            <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{licao.titulo}</p>
          )}
        </div>
        {fase === "respondendo" && prazoEm && (
          <Cronometro prazoEm={prazoEm} onExpire={() => void enviar(true)} />
        )}
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-4">
        {mostrarTravado && tentativaEnviada ? (
          <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 text-center space-y-3">
            <Lock className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))]" />
            <p className="text-base font-semibold">Tentativa já enviada</p>
            <p className="text-sm text-[hsl(var(--dark-muted))]">
              Nota:{" "}
              <strong className="text-[hsl(var(--dark-text))]">
                {Number(tentativaEnviada.nota ?? 0).toFixed(1).replace(".", ",")}
              </strong>{" "}
              · {tentativaEnviada.acertos ?? 0} de {tentativaEnviada.total} acertos. As respostas
              estão travadas e não podem ser editadas.
            </p>
            <Button onClick={() => navigate("/batismo/curso")} variant="secondary">
              Voltar ao curso
            </Button>
          </div>
        ) : fase === "regras" ? (
          <RegrasTentativa
            titulo={titulo}
            quantidadeQuestoes={quantidade}
            tempoMin={tempoMin}
            onComecar={() => void comecar()}
            comecando={comecando}
          />
        ) : fase === "respondendo" ? (
          <>
            <div className="flex items-center justify-between text-xs text-[hsl(var(--dark-muted))]">
              <span>
                {respondidas} de {questoes.length} respondidas
              </span>
              <span>Ao zerar o tempo, o envio é automático</span>
            </div>
            <div className="w-full h-1.5 bg-[hsl(var(--dark-card))] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${questoes.length ? (respondidas / questoes.length) * 100 : 0}%` }}
              />
            </div>
            {questoes.map((q, idx) => (
              <QuestaoCard
                key={q.codigo}
                questao={q}
                numero={idx + 1}
                total={questoes.length}
                selecionada={respostas[q.codigo] ?? null}
                onSelecionar={(r) => setRespostas((prev) => ({ ...prev, [q.codigo]: r }))}
                desabilitado={enviando}
              />
            ))}
            <Button
              onClick={() => void enviar(false)}
              disabled={enviando}
              className="w-full h-12 text-base"
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Enviar respostas
            </Button>
            <p className="text-[11px] text-center text-[hsl(var(--dark-muted))]">
              Depois de enviar, não dá para editar nem refazer.
            </p>
          </>
        ) : (
          resultado && (
            <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-6 text-center space-y-3">
              <CheckCircle2 className="w-10 h-10 mx-auto text-green-400" />
              <p className="text-lg font-bold">Respostas enviadas!</p>
              <p className="text-4xl font-bold">
                {Number(resultado.nota).toFixed(1).replace(".", ",")}
              </p>
              <p className="text-sm text-[hsl(var(--dark-muted))]">
                {resultado.acertos} de {resultado.total} acertos
                {resultado.media !== null && (
                  <>
                    {" "}· Média do curso:{" "}
                    <strong className="text-[hsl(var(--dark-text))]">
                      {Number(resultado.media).toFixed(1).replace(".", ",")}
                    </strong>
                  </>
                )}
              </p>
              {resultado.status_inscricao === "aprovado" && (
                <p className="text-sm text-green-400 font-medium">
                  Parabéns! Você foi aprovado(a). O próximo passo é a conversa com o presbítero ou
                  com o pastor.
                </p>
              )}
              {resultado.status_inscricao === "reprovado" && (
                <p className="text-sm text-amber-500 font-medium">
                  Sua média ficou abaixo do mínimo. Fale com a liderança para liberar a prova de
                  recuperação.
                </p>
              )}
              <Button onClick={() => navigate("/batismo/curso")} className="h-11">
                Voltar ao curso
              </Button>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default BatismoTentativaPage;
