import type { BatismoQuestaoSorteada } from "@/lib/batismo";

interface QuestaoCardProps {
  questao: BatismoQuestaoSorteada;
  numero: number;
  total: number;
  selecionada: string | null;
  onSelecionar: (resposta: string) => void;
  desabilitado?: boolean;
}

const LETRAS = ["a", "b", "c", "d", "e", "f"];

/** Cartão de uma questão sorteada (enunciado + alternativas). */
const QuestaoCard = ({
  questao,
  numero,
  total,
  selecionada,
  onSelecionar,
  desabilitado = false,
}: QuestaoCardProps) => {
  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-4 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--dark-muted))]">
        Questão {numero} de {total}
        <span className="ml-2 normal-case font-normal">({questao.codigo})</span>
      </p>
      <p className="text-base font-semibold leading-relaxed">{questao.enunciado}</p>
      <div className="space-y-2">
        {questao.alternativas.map((alt, idx) => {
          const ativa = selecionada === alt;
          return (
            <button
              key={`${questao.codigo}-${idx}`}
              type="button"
              disabled={desabilitado}
              onClick={() => onSelecionar(alt)}
              className={`w-full flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                ativa
                  ? "border-primary bg-primary/10"
                  : "border-[hsl(var(--dark-card-hover))] bg-[hsl(var(--dark-bg))] hover:border-primary/40"
              } ${desabilitado ? "opacity-70" : ""}`}
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-full grid place-items-center text-[11px] font-bold ${
                  ativa
                    ? "bg-primary text-primary-foreground"
                    : "bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-muted))]"
                }`}
              >
                {LETRAS[idx] || idx + 1}
              </span>
              <span className="text-sm leading-relaxed">{alt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuestaoCard;
