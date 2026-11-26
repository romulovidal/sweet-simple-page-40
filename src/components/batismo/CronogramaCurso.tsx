import { CalendarDays, CheckCircle2, Lock, Clock } from "lucide-react";
import {
  dataLiberacaoLicao,
  exercicioDaLicao,
  formatarDataBR,
  type BatismoLicao,
  type BatismoTentativa,
} from "@/lib/batismo";

interface CronogramaCursoProps {
  licoes: BatismoLicao[];
  iniciadoEm: Date;
  intervaloHoras: number;
  tentativas?: BatismoTentativa[];
  /** Mostra a prova final como última etapa do cronograma. */
  mostrarProvaFinal?: boolean;
}

/**
 * Cronograma do curso: data prevista de liberação de cada lição,
 * calculada a partir do início e do ritmo configurado no admin.
 */
const CronogramaCurso = ({
  licoes,
  iniciadoEm,
  intervaloHoras,
  tentativas = [],
  mostrarProvaFinal = true,
}: CronogramaCursoProps) => {
  const agora = new Date();
  const totalDias = licoes.length > 0 ? licoes.length : 6;
  const dataProva =
    licoes.length > 0
      ? dataLiberacaoLicao(iniciadoEm, licoes.length, intervaloHoras)
      : iniciadoEm;

  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">Cronograma do curso</span>
      </div>
      <p className="text-xs text-[hsl(var(--dark-muted))] mb-3">
        {totalDias} lições · 1 por dia · conclusão prevista para {formatarDataBR(dataProva)}
      </p>
      <div className="space-y-2">
        {licoes.map((licao) => {
          const data = dataLiberacaoLicao(iniciadoEm, licao.ordem, intervaloHoras);
          const concluida = !!exercicioDaLicao(tentativas, licao.id);
          const liberada = agora >= data;
          return (
            <div
              key={licao.id}
              className="flex items-center gap-3 rounded-xl bg-[hsl(var(--dark-bg))] px-3 py-2.5"
            >
              {concluida ? (
                <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              ) : liberada ? (
                <Clock className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <Lock className="w-4 h-4 text-[hsl(var(--dark-muted))] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  Lição {licao.ordem} — {licao.titulo}
                </p>
                <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                  {concluida
                    ? "Concluída"
                    : liberada
                      ? "Liberada"
                      : `Libera em ${formatarDataBR(data)}`}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[hsl(var(--dark-muted))] shrink-0">
                {formatarDataBR(data)}
              </span>
            </div>
          );
        })}
        {mostrarProvaFinal && (
          <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2.5">
            <CalendarDays className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Prova final</p>
              <p className="text-[11px] text-[hsl(var(--dark-muted))]">
                Após concluir as {totalDias} lições
              </p>
            </div>
            <span className="text-[11px] font-semibold text-primary shrink-0">
              {formatarDataBR(dataProva)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default CronogramaCurso;
