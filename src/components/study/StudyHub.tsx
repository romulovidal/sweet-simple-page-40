import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, History, MapPin, Sparkles, ChevronRight, GraduationCap } from "lucide-react";
import { BIBLE_CHARACTERS, findCharacterByName } from "@/data/bibleCharacters";
import { BIBLE_TIMELINE } from "@/data/bibleTimeline";
import { BIBLE_MAPS } from "@/data/bibleMaps";
import { bibleUrlFromReference } from "@/lib/bibleNav";
import CharacterStage from "./CharacterStage";
import TimelineStage from "./TimelineStage";
import MapStage from "./MapStage";

type Module = "characters" | "timeline" | "maps" | null;

/**
 * Estudos Bíblicos hub — 3 modules that open as fullscreen stages.
 * Cross-linked: timeline can open characters, all can open Bible references.
 */
const StudyHub = () => {
  const navigate = useNavigate();
  const [active, setActive] = useState<Module>(null);
  const [initialCharacterId, setInitialCharacterId] = useState<string | undefined>();

  const openBibleReference = useCallback(
    (ref: string) => {
      const url = bibleUrlFromReference(ref);
      if (url) {
        navigate(url);
        setActive(null);
      }
    },
    [navigate]
  );

  const openCharacterByName = useCallback((name: string) => {
    const c = findCharacterByName(name);
    if (c) {
      setInitialCharacterId(c.id);
      setActive("characters");
    }
  }, []);

  const modules = [
    {
      id: "characters" as const,
      label: "Personagens",
      sub: "Ouça-os se apresentando",
      icon: Users,
      color: "217 91% 60%",
      count: BIBLE_CHARACTERS.length,
      countLabel: "perfis",
      preview: BIBLE_CHARACTERS.slice(0, 8).map((c) => c.icon),
    },
    {
      id: "timeline" as const,
      label: "Linha do Tempo",
      sub: "Da Criação ao Apocalipse",
      icon: History,
      color: "38 92% 55%",
      count: BIBLE_TIMELINE.length,
      countLabel: "eras",
      preview: BIBLE_TIMELINE.map((e) => e.icon),
    },
    {
      id: "maps" as const,
      label: "Mapas Bíblicos",
      sub: "Rotas que mudaram a história",
      icon: MapPin,
      color: "142 71% 45%",
      count: BIBLE_MAPS.length,
      countLabel: "jornadas",
      preview: BIBLE_MAPS.map((m) => m.icon),
    },
  ];

  return (
    <div className="w-full">
      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl px-5 py-5 mb-4"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary) / 0.15) 0%, hsl(var(--dark-card)) 60%, hsl(var(--dark-card-hover)) 100%)",
          border: "1px solid hsl(var(--primary) / 0.25)",
        }}
      >
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-40 bg-primary" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <GraduationCap className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
              Estudos Bíblicos
            </p>
            <h2 className="text-lg font-black text-dark-text leading-tight mt-1">
              Conheça a história por trás dos versículos
            </h2>
            <p className="text-xs text-dark-muted leading-snug mt-1">
              Personagens que se apresentam, uma linha do tempo viva e mapas com rotas
              interativas — tudo conectado à Bíblia.
            </p>
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => {
                if (m.id === "characters") setInitialCharacterId(undefined);
                setActive(m.id);
              }}
              className="group relative overflow-hidden rounded-2xl p-4 text-left bg-dark-card active:scale-[0.99] transition-all"
              style={{
                border: `1px solid hsl(${m.color} / 0.28)`,
                boxShadow: `0 18px 40px -22px hsl(${m.color} / 0.6)`,
              }}
            >
              <div
                className="pointer-events-none absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition-opacity"
                style={{ background: `hsl(${m.color} / 0.55)` }}
              />
              <div className="relative flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, hsl(${m.color}) 0%, hsl(${m.color} / 0.6) 100%)`,
                  }}
                >
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-bold text-dark-text leading-tight">
                      {m.label}
                    </p>
                    <ChevronRight
                      className="w-4 h-4 group-hover:translate-x-1 transition-transform"
                      style={{ color: `hsl(${m.color})` }}
                    />
                  </div>
                  <p className="text-[12px] text-dark-muted leading-snug mt-0.5">
                    {m.sub}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        color: `hsl(${m.color})`,
                        background: `hsl(${m.color} / 0.15)`,
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" />
                      {m.count} {m.countLabel}
                    </span>
                    <div className="flex -space-x-1.5">
                      {m.preview.slice(0, 5).map((emoji, i) => (
                        <span
                          key={i}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] shadow"
                          style={{
                            background: `hsl(${m.color} / 0.2)`,
                            border: `1px solid hsl(${m.color} / 0.4)`,
                          }}
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Stages */}
      <CharacterStage
        open={active === "characters"}
        onOpenChange={(v) => !v && setActive(null)}
        onNavigateReference={openBibleReference}
        initialCharacterId={initialCharacterId}
      />
      <TimelineStage
        open={active === "timeline"}
        onOpenChange={(v) => !v && setActive(null)}
        onNavigateReference={openBibleReference}
        onOpenCharacter={openCharacterByName}
      />
      <MapStage
        open={active === "maps"}
        onOpenChange={(v) => !v && setActive(null)}
        onNavigateReference={openBibleReference}
      />
    </div>
  );
};

export default StudyHub;