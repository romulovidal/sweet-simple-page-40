import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import PageHead from "@/components/PageHead";
import CronogramaCurso from "@/components/batismo/CronogramaCurso";
import { useBatismoConfig, useBatismoLicoes, useMinhaInscricao } from "@/hooks/useBatismo";
import { Loader2, Droplets } from "lucide-react";

/** Tela de apresentação do Curso de Preparação para o Batismo. */
const BatismoPage = () => {
  const navigate = useNavigate();
  const { config, loading: loadingConfig } = useBatismoConfig();
  const { licoes, loading: loadingLicoes } = useBatismoLicoes();
  const { inscricao, loading: loadingInscricao } = useMinhaInscricao();

  const carregando = loadingConfig || loadingLicoes || loadingInscricao;
  const iniciadoEm = inscricao ? new Date(inscricao.iniciado_em) : new Date();

  return (
    <div className="pb-24 min-h-screen">
      <PageHead
        title="Inscrição para Batismo — Bíblia do Atalaia"
        description="Curso de Preparação para o Batismo do Ministério Atalaias de Betel: 6 lições, exercícios e prova final, direto no app."
        path="/batismo"
        breadcrumbs={[
          { name: "Início", path: "/" },
          { name: "Batismo", path: "/batismo" },
        ]}
      />

      <header className="px-5 pt-12 pb-4 max-w-2xl mx-auto text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 border border-amber-600/25 dark:border-amber-400/20 flex items-center justify-center mb-4">
          <Droplets className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400/90 font-semibold">
          Ministério Atalaias de Betel
        </p>
        <h1 className="text-2xl font-bold mt-2">Curso de Preparação para o Batismo</h1>
      </header>

      <div className="px-5 max-w-2xl mx-auto space-y-5">
        <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 space-y-3 text-sm leading-relaxed">
          <p>
            <strong>Bem-vindo(a) ao Curso de Preparação para o Batismo!</strong>
          </p>
          <p className="text-[hsl(var(--dark-muted))]">
            Você decidiu seguir Jesus e quer se batizar. Que alegria! Antes do grande dia, este
            curso vai te ajudar a entender, passo a passo e com palavras simples, o que significa
            ser cristão, o que é o batismo nas águas, o que é a Ceia do Senhor e como viver a nova
            vida com Jesus.
          </p>
          <p className="text-[hsl(var(--dark-muted))]">
            São <strong className="text-[hsl(var(--dark-text))]">6 lições curtas</strong>, uma por
            dia. No fim de cada lição há um exercício. No final do curso, uma prova. Leia com
            calma, abra a Bíblia nos versículos indicados e responda com sinceridade.
          </p>
          <blockquote className="border-l-2 border-amber-500/50 pl-3 italic text-[hsl(var(--dark-muted))]">
            "Se com a tua boca confessares ao Senhor Jesus, e em teu coração creres que Deus o
            ressuscitou dentre os mortos, serás salvo." — Romanos 10:9
          </blockquote>
        </div>

        {carregando ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {config && (
              <CronogramaCurso
                licoes={licoes}
                iniciadoEm={iniciadoEm}
                intervaloHoras={config.intervalo_liberacao_horas}
              />
            )}

            {inscricao ? (
              <Button onClick={() => navigate("/batismo/curso")} className="w-full h-12 text-base">
                Continuar meu curso
              </Button>
            ) : config?.inscricoes_abertas ? (
              <Button
                onClick={() => navigate("/batismo/inscricao")}
                className="w-full h-12 text-base"
              >
                Fazer minha inscrição
              </Button>
            ) : (
              <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-4 text-center text-sm text-[hsl(var(--dark-muted))]">
                As inscrições para o batismo estão fechadas no momento. Fique atento(a) aos avisos!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BatismoPage;
