import { useMemo } from "react";
import { Users, MapPin, BookOpen, Clock, Sparkles, Book, Lightbulb, Info, GitBranch } from "lucide-react";
import { getCharacter, getEvent, getPlace, getBook, getPeriod, relatedForCharacter, relatedForEvent, relatedForPlace, relatedForBook } from "../lib/graph";
import { CHARACTERS } from "../data/characters";
import { EVENTS } from "../data/events";
import type { EntityRef } from "../types";
import { formatYear } from "../data/periods";
import EntityHeader from "./shared/EntityHeader";
import Section from "./shared/Section";
import Chip from "./shared/Chip";
import RefLink from "./shared/RefLink";
import { useFavorites } from "../hooks/useFavorites";
import GenealogyTree from "./Genealogy/GenealogyTree";

interface Props {
  target: EntityRef;
  onBack?: () => void;
  onClose: () => void;
  onNavigate: (target: EntityRef) => void;
}

const share = async (title: string, text: string) => {
  try {
    if (navigator.share) await navigator.share({ title, text });
    else { await navigator.clipboard.writeText(`${title}\n${text}`); alert("Copiado!"); }
  } catch {}
};

const EntityDetail = ({ target, onBack, onClose, onNavigate }: Props) => {
  const { isFav, toggle } = useFavorites();

  if (target.kind === "character") return <CharacterView id={target.id} {...{ onBack, onClose, onNavigate, isFav, toggle }} />;
  if (target.kind === "event") return <EventView id={target.id} {...{ onBack, onClose, onNavigate, isFav, toggle }} />;
  if (target.kind === "place") return <PlaceView id={target.id} {...{ onBack, onClose, onNavigate, isFav, toggle }} />;
  if (target.kind === "book") return <BookView id={target.id} {...{ onBack, onClose, onNavigate, isFav, toggle }} />;
  if (target.kind === "period") return <PeriodView id={target.id} {...{ onBack, onClose, onNavigate }} />;
  return null;
};

type ViewProps = {
  id: string;
  onBack?: () => void;
  onClose: () => void;
  onNavigate: (r: EntityRef) => void;
  isFav: (k: any, id: string) => boolean;
  toggle: (k: any, id: string) => void;
};

// ── Character ──
const CharacterView = ({ id, onBack, onClose, onNavigate, isFav, toggle }: ViewProps) => {
  const c = getCharacter(id);
  const rel = useMemo(() => (c ? relatedForCharacter(c) : null), [c]);
  if (!c || !rel) return null;
  const period = getPeriod(c.periodId);
  return (
    <div className="pb-24">
      <EntityHeader
        title={c.name}
        subtitle={`${period?.name ?? ""} · ${formatYear(c.year)} · aprox.`}
        icon={c.icon}
        onBack={onBack}
        onToggleFav={() => toggle("character", c.id)}
        isFav={isFav("character", c.id)}
        onShare={() => share(c.name, c.bio)}
      />

      {c.meaning && (
        <p className="px-4 pt-3 text-[11px] text-dark-muted"><span className="font-bold">Significado:</span> {c.meaning}</p>
      )}

      <Section title="Biografia" icon={<Info className="w-3.5 h-3.5" />}>
        <p className="text-sm leading-relaxed text-dark-text">{c.bio}</p>
      </Section>

      {c.family && Object.values(c.family).some((v) => v && v.length) && (
        <Section title="Família" icon={<Users className="w-3.5 h-3.5" />}>
          <div className="space-y-1.5 text-[12px]">
            {([
              ["fathers", "Pais"],
              ["mothers", "Mães"],
              ["spouses", "Cônjuges"],
              ["siblings", "Irmãos"],
              ["children", "Filhos"],
            ] as const).map(([k, label]) => {
              const ids = (c.family as any)?.[k] as string[] | undefined;
              if (!ids?.length) return null;
              return (
                <div key={k} className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-dark-muted min-w-[62px]">{label}:</span>
                  {ids.map((cid) => {
                    const co = getCharacter(cid);
                    return (
                      <Chip key={cid} onClick={() => co && onNavigate({ kind: "character", id: cid })}>
                        {co ? `${co.icon} ${co.name}` : cid}
                      </Chip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {c.family && Object.values(c.family).some((v) => v && v.length) && (
        <Section title="Genealogia" icon={<GitBranch className="w-3.5 h-3.5" />}>
          <GenealogyTree character={c} onNavigate={onNavigate} />
        </Section>
      )}

      {c.keyVerses?.length ? (
        <Section title="Versículos principais" icon={<Book className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-1 gap-2">
            {c.keyVerses.map((v) => <RefLink key={v.ref} reference={v.ref} note={v.note} />)}
          </div>
        </Section>
      ) : null}

      {rel.events.length > 0 && (
        <Section title="Eventos" icon={<Clock className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.events.map((e) => (
              <Chip key={e.id} onClick={() => onNavigate({ kind: "event", id: e.id })}>
                {e.icon} {e.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {rel.places.length > 0 && (
        <Section title="Lugares" icon={<MapPin className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.places.map((p) => (
              <Chip key={p.id} onClick={() => onNavigate({ kind: "place", id: p.id })}>📍 {p.name}</Chip>
            ))}
          </div>
        </Section>
      )}

      {rel.contemporaries.length > 0 && (
        <Section title="Quem viveu com ele" icon={<Users className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.contemporaries.map((o) => (
              <Chip key={o.id} onClick={() => onNavigate({ kind: "character", id: o.id })}>
                {o.icon} {o.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {c.curiosities?.length ? (
        <Section title="Curiosidades" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <ul className="space-y-1 text-[12px] text-dark-text">
            {c.curiosities.map((cu, i) => <li key={i} className="pl-3 border-l-2 border-primary">{cu}</li>)}
          </ul>
        </Section>
      ) : null}

      {c.lessons?.length ? (
        <Section title="Lições" icon={<Lightbulb className="w-3.5 h-3.5" />}>
          <ul className="space-y-1 text-[12px] text-dark-text">
            {c.lessons.map((l, i) => <li key={i} className="pl-3 border-l-2 border-primary">{l}</li>)}
          </ul>
        </Section>
      ) : null}

      {rel.books.length > 0 && (
        <Section title="Livros relacionados" icon={<BookOpen className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.books.map((b) => (
              <Chip key={b.id} onClick={() => onNavigate({ kind: "book", id: b.id })}>
                📖 {b.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// ── Event ──
const EventView = ({ id, onBack, onClose, onNavigate, isFav, toggle }: ViewProps) => {
  const e = getEvent(id);
  const rel = useMemo(() => (e ? relatedForEvent(e) : null), [e]);
  if (!e || !rel) return null;
  return (
    <div className="pb-24">
      <EntityHeader
        title={e.name}
        subtitle={`${rel.period?.name ?? ""} · ${e.approximate ? "~" : ""}${formatYear(e.year)}`}
        icon={e.icon}
        onBack={onBack}
        onToggleFav={() => toggle("event", e.id)}
        isFav={isFav("event", e.id)}
        onShare={() => share(e.name, e.description)}
      />

      <Section title="O que aconteceu" icon={<Info className="w-3.5 h-3.5" />}>
        <p className="text-sm leading-relaxed">{e.description}</p>
      </Section>

      {e.context && (
        <Section title="Contexto histórico" icon={<Clock className="w-3.5 h-3.5" />}>
          <p className="text-sm leading-relaxed text-dark-muted">{e.context}</p>
        </Section>
      )}

      {e.tags.length > 0 && (
        <div className="px-4 flex flex-wrap gap-1.5">
          {e.tags.map((t) => <Chip key={t}>{t}</Chip>)}
          {e.approximate && <Chip title="Data aproximada">≈ estimativa</Chip>}
        </div>
      )}

      {e.references.length > 0 && (
        <Section title="Referências bíblicas" icon={<Book className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-1 gap-2">
            {e.references.map((r) => <RefLink key={r} reference={r} />)}
          </div>
        </Section>
      )}

      {rel.characters.length > 0 && (
        <Section title="Personagens envolvidos" icon={<Users className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.characters.map((c) => (
              <Chip key={c.id} onClick={() => onNavigate({ kind: "character", id: c.id })}>
                {c.icon} {c.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}

      {rel.places.length > 0 && (
        <Section title="Lugares" icon={<MapPin className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.places.map((p) => (
              <Chip key={p.id} onClick={() => onNavigate({ kind: "place", id: p.id })}>📍 {p.name}</Chip>
            ))}
          </div>
        </Section>
      )}

      {e.application && (
        <Section title="Aplicação" icon={<Lightbulb className="w-3.5 h-3.5" />}>
          <p className="text-sm leading-relaxed">{e.application}</p>
        </Section>
      )}

      {e.curiosities?.length ? (
        <Section title="Curiosidades" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <ul className="space-y-1 text-[12px]">
            {e.curiosities.map((cu, i) => <li key={i} className="pl-3 border-l-2 border-primary">{cu}</li>)}
          </ul>
        </Section>
      ) : null}

      {rel.nearbyEvents.length > 0 && (
        <Section title="Eventos próximos no tempo" icon={<Clock className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.nearbyEvents.map((n) => (
              <Chip key={n.id} onClick={() => onNavigate({ kind: "event", id: n.id })}>
                {n.icon} {n.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// ── Place ──
const PlaceView = ({ id, onBack, onClose, onNavigate, isFav, toggle }: ViewProps) => {
  const p = getPlace(id);
  const rel = useMemo(() => (p ? relatedForPlace(p) : null), [p]);
  if (!p || !rel) return null;
  return (
    <div className="pb-24">
      <EntityHeader
        title={p.name}
        subtitle={p.region}
        icon="📍"
        onBack={onBack}
        onToggleFav={() => toggle("place", p.id)}
        isFav={isFav("place", p.id)}
        onShare={() => share(p.name, p.description)}
      />
      <Section title="Sobre" icon={<Info className="w-3.5 h-3.5" />}>
        <p className="text-sm leading-relaxed">{p.description}</p>
      </Section>
      {rel.events.length > 0 && (
        <Section title="Eventos que aconteceram aqui" icon={<Clock className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.events.map((e) => (
              <Chip key={e.id} onClick={() => onNavigate({ kind: "event", id: e.id })}>
                {e.icon} {e.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      {rel.characters.length > 0 && (
        <Section title="Personagens" icon={<Users className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.characters.map((c) => (
              <Chip key={c.id} onClick={() => onNavigate({ kind: "character", id: c.id })}>
                {c.icon} {c.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// ── Book ──
const BookView = ({ id, onBack, onClose, onNavigate, isFav, toggle }: ViewProps) => {
  const b = getBook(id);
  const rel = useMemo(() => (b ? relatedForBook(b) : null), [b]);
  if (!b || !rel) return null;
  return (
    <div className="pb-24">
      <EntityHeader
        title={b.name}
        subtitle={b.theme}
        icon="📖"
        onBack={onBack}
        onToggleFav={() => toggle("book", b.id)}
        isFav={isFav("book", b.id)}
      />
      <Section title="Ficha" icon={<Info className="w-3.5 h-3.5" />}>
        <div className="text-sm space-y-1">
          {b.author && <p><span className="text-dark-muted">Autor:</span> {b.author}</p>}
          {b.theme && <p><span className="text-dark-muted">Tema:</span> {b.theme}</p>}
          {rel.period && <p><span className="text-dark-muted">Período:</span> {rel.period.name}</p>}
          {b.chapters && <p><span className="text-dark-muted">Capítulos:</span> {b.chapters}</p>}
        </div>
      </Section>
      {b.intro && (
        <Section title="Introdução" icon={<Info className="w-3.5 h-3.5" />}>
          <p className="text-sm leading-relaxed text-dark-text">{b.intro}</p>
        </Section>
      )}
      {b.keyEvents?.length ? (
        <Section title="Eventos-chave" icon={<Clock className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {b.keyEvents.map((e) => <Chip key={e}>{e}</Chip>)}
          </div>
        </Section>
      ) : null}
      {b.keyMiracles?.length ? (
        <Section title="Milagres" icon={<Sparkles className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {b.keyMiracles.map((m) => <Chip key={m}>✨ {m}</Chip>)}
          </div>
        </Section>
      ) : null}
      {b.keyProphecies?.length ? (
        <Section title="Profecias" icon={<Book className="w-3.5 h-3.5" />}>
          <div className="grid grid-cols-1 gap-2">
            {b.keyProphecies.map((p) => <RefLink key={p.ref} reference={p.ref} note={p.note} />)}
          </div>
        </Section>
      ) : null}
      <Section title="Ler no aplicativo" icon={<Book className="w-3.5 h-3.5" />}>
        <RefLink reference={`${b.name} 1`} note="Abrir capítulo 1" />
      </Section>
      {rel.characters.length > 0 && (
        <Section title="Personagens desta época" icon={<Users className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.characters.map((c) => (
              <Chip key={c.id} onClick={() => onNavigate({ kind: "character", id: c.id })}>
                {c.icon} {c.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      {rel.events.length > 0 && (
        <Section title="Eventos desta época" icon={<Clock className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {rel.events.map((e) => (
              <Chip key={e.id} onClick={() => onNavigate({ kind: "event", id: e.id })}>
                {e.icon} {e.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

// ── Period ──
const PeriodView = ({ id, onBack, onClose, onNavigate }: Omit<ViewProps, "isFav" | "toggle">) => {
  const p = getPeriod(id);
  if (!p) return null;
  const chars = useMemo(() => CHARACTERS.filter((c) => c.periodId === p.id), [p]);
  const evts = useMemo(() => EVENTS.filter((e) => e.periodId === p.id), [p]);
  return (
    <div className="pb-24">
      <EntityHeader
        title={p.name}
        subtitle={`${p.subtitle} · ${formatYear(p.startYear)} → ${formatYear(p.endYear)}`}
        icon={p.icon}
        onBack={onBack}
      />
      <Section title="Sobre este período" icon={<Info className="w-3.5 h-3.5" />}>
        <p className="text-sm leading-relaxed">{p.description}</p>
      </Section>
      {chars.length > 0 && (
        <Section title={`Personagens (${chars.length})`} icon={<Users className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {chars.map((c: any) => (
              <Chip key={c.id} onClick={() => onNavigate({ kind: "character", id: c.id })}>
                {c.icon} {c.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      {evts.length > 0 && (
        <Section title={`Eventos (${evts.length})`} icon={<Clock className="w-3.5 h-3.5" />}>
          <div className="flex flex-wrap gap-1.5">
            {evts.map((e: any) => (
              <Chip key={e.id} onClick={() => onNavigate({ kind: "event", id: e.id })}>
                {e.icon} {e.name}
              </Chip>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

export default EntityDetail;
