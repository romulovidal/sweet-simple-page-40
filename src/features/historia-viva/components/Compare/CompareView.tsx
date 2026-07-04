import { useMemo, useState } from "react";
import { CHARACTERS } from "../../data/characters";
import { PLACES } from "../../data/places";
import { BOOKS } from "../../data/books";
import { PERIODS } from "../../data/periods";
import { ArrowRightLeft, Shuffle, Search } from "lucide-react";
import Chip from "../shared/Chip";
import type { EntityRef } from "../../types";

type CmpKind = "character" | "place" | "book";

interface Props { onOpen: (ref: EntityRef) => void }

function pickList(kind: CmpKind) {
  if (kind === "character") return CHARACTERS as any[];
  if (kind === "place") return PLACES as any[];
  return BOOKS as any[];
}

const CompareView = ({ onOpen }: Props) => {
  const [kind, setKind] = useState<CmpKind>("character");
  const [aId, setAId] = useState<string | null>(null);
  const [bId, setBId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<"a" | "b">("a");

  const list = pickList(kind);
  const A = list.find((x) => x.id === aId);
  const B = list.find((x) => x.id === bId);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return list.slice(0, 30);
    return list.filter((x: any) => x.name.toLowerCase().includes(n)).slice(0, 30);
  }, [q, list]);

  const rows = useMemo(() => buildRows(kind, A, B), [kind, A, B]);

  const setId = (id: string) => {
    if (target === "a") { setAId(id); setTarget("b"); }
    else { setBId(id); setTarget("a"); }
    setQ("");
  };

  const swap = () => { const t = aId; setAId(bId); setBId(t); };
  const randomize = () => {
    const rand = () => list[Math.floor(Math.random() * list.length)]?.id;
    let a = rand(); let b = rand(); if (a === b) b = list[(list.findIndex((x) => x.id === a) + 1) % list.length]?.id;
    setAId(a); setBId(b);
  };

  const resetKind = (k: CmpKind) => { setKind(k); setAId(null); setBId(null); setQ(""); setTarget("a"); };

  return (
    <div className="p-4 space-y-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {(["character", "place", "book"] as CmpKind[]).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => resetKind(k)}>
            {k === "character" ? "👤 Personagens" : k === "place" ? "📍 Lugares" : "📖 Livros"}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[{ item: A, key: "a" as const, label: "A" }, { item: B, key: "b" as const, label: "B" }].map(({ item, key, label }) => (
          <button
            key={key}
            onClick={() => setTarget(key)}
            className="rounded-2xl p-3 bg-dark-card border-2 text-left min-h-[92px] flex flex-col justify-between"
            style={{ borderColor: target === key ? "hsl(var(--primary) / 0.6)" : "transparent" }}
          >
            <span className="text-[10px] font-black uppercase tracking-widest text-dark-muted">Selecionado {label}</span>
            {item ? (
              <>
                <p className="text-sm font-bold text-dark-text truncate mt-1">{item.name}</p>
                <p className="text-[10px] text-dark-muted truncate">{subOf(kind, item)}</p>
              </>
            ) : (
              <p className="text-[12px] text-dark-muted mt-1">Toque e escolha abaixo</p>
            )}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={swap} disabled={!aId || !bId} className="flex-1 h-9 rounded-xl bg-dark-card text-[11px] font-bold text-dark-text flex items-center justify-center gap-1.5 disabled:opacity-40">
          <ArrowRightLeft className="w-3.5 h-3.5" /> Trocar
        </button>
        <button onClick={randomize} className="flex-1 h-9 rounded-xl bg-dark-card text-[11px] font-bold text-dark-text flex items-center justify-center gap-1.5">
          <Shuffle className="w-3.5 h-3.5" /> Aleatórios
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Buscar para colocar em ${target.toUpperCase()}…`}
          className="w-full bg-dark-card rounded-xl pl-10 pr-3 py-2 text-sm placeholder:text-dark-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {(q || (!A || !B)) && (
        <div className="max-h-40 overflow-y-auto rounded-xl bg-dark-card divide-y divide-dark-card-hover">
          {filtered.map((x: any) => (
            <button key={x.id} onClick={() => setId(x.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left active:bg-dark-card-hover">
              <span className="text-sm text-dark-text truncate flex-1">{x.name}</span>
              <span className="text-[10px] text-dark-muted">{subOf(kind, x)}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="p-3 text-[12px] text-dark-muted text-center">Sem resultados.</p>}
        </div>
      )}

      {A && B && (
        <div className="mt-2 rounded-2xl bg-dark-card overflow-hidden">
          {rows.map((row, i) => {
            const diff = row.a !== row.b;
            return (
              <div key={i} className="grid grid-cols-[92px_1fr_1fr] text-[12px] border-b border-dark-card-hover last:border-0"
                style={{ background: diff ? "hsl(var(--primary) / 0.06)" : undefined }}>
                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-dark-muted border-r border-dark-card-hover">{row.label}</div>
                <div className="px-3 py-2 text-dark-text border-r border-dark-card-hover">{row.a || "—"}</div>
                <div className="px-3 py-2 text-dark-text">{row.b || "—"}</div>
              </div>
            );
          })}
          <div className="p-3 flex gap-2">
            <button onClick={() => onOpen({ kind, id: A.id })} className="flex-1 h-9 rounded-lg bg-dark-card-hover text-[11px] font-bold text-dark-text">Abrir {A.name}</button>
            <button onClick={() => onOpen({ kind, id: B.id })} className="flex-1 h-9 rounded-lg bg-dark-card-hover text-[11px] font-bold text-dark-text">Abrir {B.name}</button>
          </div>
        </div>
      )}
    </div>
  );
};

function periodName(id?: string) {
  return PERIODS.find((p) => p.id === id)?.name ?? "—";
}

function subOf(kind: CmpKind, x: any) {
  if (kind === "character") return periodName(x.periodId);
  if (kind === "place") return x.region ?? "";
  return x.theme ?? "";
}

function buildRows(kind: CmpKind, A: any, B: any) {
  if (!A || !B) return [];
  if (kind === "character") {
    return [
      { label: "Período", a: periodName(A.periodId), b: periodName(B.periodId) },
      { label: "Ano aprox.", a: fmtYear(A.year), b: fmtYear(B.year) },
      { label: "Papéis", a: (A.tags ?? []).join(", "), b: (B.tags ?? []).join(", ") },
      { label: "Filhos", a: (A.family?.children ?? []).join(", "), b: (B.family?.children ?? []).join(", ") },
      { label: "Cônjuges", a: (A.family?.spouses ?? []).join(", "), b: (B.family?.spouses ?? []).join(", ") },
      { label: "Lugares", a: (A.placeIds ?? []).join(", "), b: (B.placeIds ?? []).join(", ") },
      { label: "Eventos", a: (A.eventIds ?? []).join(", "), b: (B.eventIds ?? []).join(", ") },
      { label: "Livros", a: (A.bookIds ?? []).join(", "), b: (B.bookIds ?? []).join(", ") },
    ];
  }
  if (kind === "place") {
    return [
      { label: "Região", a: A.region ?? "—", b: B.region ?? "—" },
      { label: "Descrição", a: A.description ?? "", b: B.description ?? "" },
      { label: "Personagens", a: (A.characterIds ?? []).join(", "), b: (B.characterIds ?? []).join(", ") },
      { label: "Eventos", a: (A.eventIds ?? []).join(", "), b: (B.eventIds ?? []).join(", ") },
    ];
  }
  return [
    { label: "Período", a: periodName(A.periodId), b: periodName(B.periodId) },
    { label: "Autor", a: A.author ?? "—", b: B.author ?? "—" },
    { label: "Tema", a: A.theme ?? "—", b: B.theme ?? "—" },
    { label: "Capítulos", a: String(A.chapters ?? "—"), b: String(B.chapters ?? "—") },
    { label: "Intro", a: A.intro ?? "", b: B.intro ?? "" },
  ];
}

function fmtYear(y?: number) {
  if (y === undefined) return "—";
  return y < 0 ? `${Math.abs(y)} aC` : `${y} dC`;
}

export default CompareView;