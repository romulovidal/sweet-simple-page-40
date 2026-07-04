import { useMemo } from "react";
import { getCharacter } from "../../data/characters";
import type { HistoriaCharacter, EntityRef } from "../../types";

interface Props {
  character: HistoriaCharacter;
  onNavigate: (ref: EntityRef) => void;
}

interface Node {
  id: string;
  name: string;
  icon: string;
  level: number; // 0 = ancestors above, 1 = self, 2 = descendants below
  role: "parent" | "spouse" | "self" | "sibling" | "child";
}

/** Simples árvore de 3 níveis: pais/mães (topo), self+cônjuge+irmãos (meio), filhos (baixo). */
const GenealogyTree = ({ character, onNavigate }: Props) => {
  const nodes = useMemo(() => {
    const list: Node[] = [];
    const push = (id: string, role: Node["role"], level: number) => {
      const c = getCharacter(id);
      if (!c) return;
      list.push({ id: c.id, name: c.name, icon: c.icon, level, role });
    };
    (character.family?.fathers ?? []).forEach((id) => push(id, "parent", 0));
    (character.family?.mothers ?? []).forEach((id) => push(id, "parent", 0));
    list.push({ id: character.id, name: character.name, icon: character.icon, level: 1, role: "self" });
    (character.family?.spouses ?? []).forEach((id) => push(id, "spouse", 1));
    (character.family?.siblings ?? []).forEach((id) => push(id, "sibling", 1));
    (character.family?.children ?? []).forEach((id) => push(id, "child", 2));
    return list;
  }, [character]);

  const parents = nodes.filter((n) => n.level === 0);
  const middle = nodes.filter((n) => n.level === 1);
  const children = nodes.filter((n) => n.level === 2);

  const hasAny = parents.length + middle.length + children.length > 1;
  if (!hasAny) {
    return <p className="text-[12px] text-dark-muted text-center py-4">Sem dados de família disponíveis.</p>;
  }

  return (
    <div className="w-full space-y-4">
      {parents.length > 0 && (
        <TreeRow title="Ancestrais" nodes={parents} onNavigate={onNavigate} lineDown />
      )}
      <TreeRow title={parents.length ? "Geração" : "Família"} nodes={middle} onNavigate={onNavigate} highlightSelf lineDown={children.length > 0} />
      {children.length > 0 && (
        <TreeRow title="Descendentes" nodes={children} onNavigate={onNavigate} />
      )}
    </div>
  );
};

interface RowProps {
  title: string;
  nodes: Node[];
  onNavigate: (ref: EntityRef) => void;
  highlightSelf?: boolean;
  lineDown?: boolean;
}

const roleLabel: Record<Node["role"], string> = {
  parent: "Pai/Mãe",
  spouse: "Cônjuge",
  self: "Você",
  sibling: "Irmão(ã)",
  child: "Filho(a)",
};

const TreeRow = ({ title, nodes, onNavigate, highlightSelf, lineDown }: RowProps) => (
  <div>
    <p className="text-[10px] font-bold uppercase tracking-widest text-dark-muted mb-2 px-1">{title}</p>
    <div className="flex flex-wrap gap-2 justify-center">
      {nodes.map((n) => {
        const isSelf = highlightSelf && n.role === "self";
        return (
          <button
            key={`${n.id}-${n.role}`}
            onClick={() => !isSelf && onNavigate({ kind: "character", id: n.id })}
            className={`relative flex flex-col items-center rounded-2xl p-2 min-w-[84px] transition-transform active:scale-95 border ${
              isSelf
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-dark-card text-dark-text border-dark-card-hover"
            }`}
            aria-label={`${n.name} (${roleLabel[n.role]})`}
          >
            <span className="text-2xl">{n.icon}</span>
            <span className="text-[11px] font-bold truncate max-w-[72px]">{n.name}</span>
            <span className="text-[9px] opacity-80">{roleLabel[n.role]}</span>
          </button>
        );
      })}
    </div>
    {lineDown && (
      <div className="flex justify-center mt-2">
        <div className="w-px h-3 bg-dark-card-hover" />
      </div>
    )}
  </div>
);

export default GenealogyTree;
