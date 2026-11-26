import { useNavigate } from "react-router-dom";
import { Droplets } from "lucide-react";
import { useBatismoConfig, useBatismoLicoes, useMinhaInscricao } from "@/hooks/useBatismo";
import { estadoDaLicao } from "@/lib/batismo";

/**
 * Card da Home (aba Hoje): "Inscrição para Batismo" para quem ainda
 * não se inscreveu; depois vira "Seu curso de batismo — Lição X de 6".
 * Segue o mesmo esqueleto visual do card "Continuar lendo".
 */
const BatismoHomeCard = () => {
  const navigate = useNavigate();
  const { config } = useBatismoConfig();
  const { licoes } = useBatismoLicoes();
  const { inscricao, tentativas, loading } = useMinhaInscricao();

  if (loading || !config) return null;
  if (!inscricao && !config.inscricoes_abertas) return null;

  const total = licoes.length || 6;
  let titulo = "Inscrição para Batismo";
  let subtitulo = "Curso de Preparação para o Batismo";
  let destino = "/batismo/inscricao";

  if (inscricao) {
    destino = "/batismo/curso";
    if (inscricao.status === "certificado_gerado") {
      titulo = "Seu certificado está pronto";
      subtitulo = "Toque para baixar o certificado";
      destino = "/batismo/certificado";
    } else if (inscricao.status === "aprovado" || inscricao.status === "conversa_realizada") {
      titulo = "Seu curso de batismo";
      subtitulo =
        inscricao.status === "aprovado"
          ? "Aprovado! Aguardando a conversa"
          : "Conversa realizada — aguardando o batismo";
    } else {
      const iniciadoEm = new Date(inscricao.iniciado_em);
      const proxima =
        licoes.find(
          (l) =>
            estadoDaLicao(l, licoes, tentativas, iniciadoEm, config.intervalo_liberacao_horas) !==
            "concluida",
        ) || licoes[licoes.length - 1];
      titulo = "Seu curso de batismo";
      subtitulo = proxima ? `Lição ${proxima.ordem} de ${total} — ${proxima.titulo}` : "Continue seu curso";
    }
  }

  return (
    <div>
      <h2 className="font-scripture text-[13px] font-semibold text-amber-700 dark:text-amber-400/90 uppercase tracking-[0.18em] mb-3">
        Batismo
      </h2>
      <button
        onClick={() => navigate(destino)}
        className="w-full bg-[hsl(var(--dark-card))] rounded-xl p-4 flex items-center gap-4 active:bg-[hsl(var(--dark-card-hover))] transition-all text-left hover:-translate-y-0.5 hover:shadow-lg animate-fade-up border border-amber-600/25 dark:border-amber-400/20"
      >
        <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Droplets className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{titulo}</p>
          <p className="text-xs text-[hsl(var(--dark-muted))] truncate">{subtitulo}</p>
        </div>
        <span className="text-xs text-[hsl(var(--dark-muted))]">→</span>
      </button>
    </div>
  );
};

export default BatismoHomeCard;
