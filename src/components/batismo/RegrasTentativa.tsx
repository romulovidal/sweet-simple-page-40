import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, FileCheck2, Lock, Play, Shuffle } from "lucide-react";

interface RegrasTentativaProps {
  titulo: string;
  quantidadeQuestoes: number;
  tempoMin: number;
  onComecar: () => void;
  comecando: boolean;
}

/**
 * Tela de regras exibida antes de iniciar um exercício ou prova.
 * O botão de começar só libera depois de marcar "concordo com os termos".
 */
const RegrasTentativa = ({
  titulo,
  quantidadeQuestoes,
  tempoMin,
  onComecar,
  comecando,
}: RegrasTentativaProps) => {
  const [aceitou, setAceitou] = useState(false);

  return (
    <div className="bg-[hsl(var(--dark-card))] rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FileCheck2 className="w-5 h-5 text-primary" />
        <h2 className="text-base font-bold">{titulo}</h2>
      </div>

      <p className="text-sm text-[hsl(var(--dark-muted))] leading-relaxed">
        Antes de começar, leia as regras com atenção:
      </p>

      <ul className="space-y-3 text-sm">
        <li className="flex items-start gap-2.5">
          <Shuffle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span>
            São <strong>{quantidadeQuestoes} questões</strong> sorteadas do banco do curso, cada
            uma com 4 alternativas e apenas <strong>uma resposta correta</strong>.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span>
            Você tem <strong>{tempoMin} minutos</strong> para concluir. O cronômetro fica visível
            na tela e, quando o tempo zerar, as respostas são{" "}
            <strong>enviadas automaticamente</strong>.
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <span>
            É <strong>uma única tentativa</strong>: depois de enviar,{" "}
            <strong>não dá para editar nem refazer</strong>. Uma nova tentativa só é possível se a
            liderança liberar uma recuperação.
          </span>
        </li>
      </ul>

      <label className="flex items-start gap-3 rounded-xl bg-[hsl(var(--dark-bg))] p-3 cursor-pointer">
        <Checkbox
          checked={aceitou}
          onCheckedChange={(v) => setAceitou(v === true)}
          className="mt-0.5"
        />
        <span className="text-sm leading-relaxed">
          Li e <strong>concordo com os termos</strong> acima e estou pronto(a) para começar.
        </span>
      </label>

      <Button
        onClick={onComecar}
        disabled={!aceitou || comecando}
        className="w-full h-12 text-base"
      >
        <Play className="w-4 h-4 mr-2" />
        {comecando ? "Preparando questões..." : "Começar agora"}
      </Button>
    </div>
  );
};

export default RegrasTentativa;
