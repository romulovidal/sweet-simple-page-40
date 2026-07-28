import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Music2, Loader2, Play, ExternalLink, Tag, User, Settings, BookOpen, HandHeart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import PageHead from "@/components/PageHead";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import AdminCanticos from "@/components/admin/AdminCanticos";
import AdminCanticosMinistros from "@/components/admin/AdminCanticosMinistros";

type LetraBloco = { tipo: "verso" | "refrao" | "ponte"; numero?: number; linhas: string[] };
type Playback = { label: string; url: string };
type Cantico = {
  id: string;
  numero: number;
  titulo: string;
  letra_json: LetraBloco[];
  categoria: string | null;
  tom: string | null;
  capotraste: number | null;
  playbacks: Playback[];
  referencia_biblica: string | null;
};
type Ministro = { id: string; nome: string };

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default function CanticosPage() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const [adminView, setAdminView] = useState<null | "canticos" | "ministros">(null);
  const [list, setList] = useState<Cantico[]>([]);
  const [ministros, setMinistros] = useState<Ministro[]>([]);
  const [linksByCantico, setLinksByCantico] = useState<Record<string, string[]>>({});
  const [linksByMinistro, setLinksByMinistro] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filterCat, setFilterCat] = useState<string>("");
  const [filterMinistro, setFilterMinistro] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [c, m, l] = await Promise.all([
        supabase.from("canticos").select("id, numero, titulo, letra_json, categoria, tom, capotraste, playbacks, referencia_biblica").eq("publicado", true).order("numero"),
        supabase.from("canticos_ministros").select("id, nome").eq("ativo", true).order("sort_order").order("nome"),
        supabase.from("canticos_ministros_link").select("cantico_id, ministro_id"),
      ]);
      setList(((c.data as unknown) as Cantico[]) || []);
      setMinistros(((m.data as unknown) as Ministro[]) || []);
      const byC: Record<string, string[]> = {};
      const byM: Record<string, string[]> = {};
      ((l.data as any[]) || []).forEach((r) => {
        byC[r.cantico_id] = [...(byC[r.cantico_id] || []), r.ministro_id];
        byM[r.ministro_id] = [...(byM[r.ministro_id] || []), r.cantico_id];
      });
      setLinksByCantico(byC);
      setLinksByMinistro(byM);
      setLoading(false);
    })();
  }, []);

  const categorias = useMemo(() => {
    const s = new Set<string>();
    list.forEach((c) => c.categoria && s.add(c.categoria));
    return Array.from(s).sort();
  }, [list]);

  const filtered = useMemo(() => {
    const qn = normalize(q.trim());
    return list.filter((c) => {
      if (filterCat && c.categoria !== filterCat) return false;
      if (filterMinistro) {
        const ids = linksByMinistro[filterMinistro] || [];
        if (!ids.includes(c.id)) return false;
      }
      if (!qn) return true;
      if (String(c.numero).includes(qn)) return true;
      if (normalize(c.titulo).includes(qn)) return true;
      const letra = (c.letra_json || []).map((b) => b.linhas.join(" ")).join(" ");
      if (normalize(letra).includes(qn)) return true;
      return false;
    });
  }, [list, q, filterCat, filterMinistro, linksByMinistro]);

  const open = list.find((c) => c.id === openId) || null;
  const openMinistros = open ? (linksByCantico[open.id] || []).map((id) => ministros.find((m) => m.id === id)?.nome).filter(Boolean) : [];

  if (isAdmin && adminView) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <PageHead title="Cânticos — Admin" description="Gestão de cânticos" path="/canticos" />
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-[hsl(var(--dark-hover-strong))]">
          <div className="flex items-center gap-3 p-4">
            <button onClick={() => setAdminView(null)} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-hover))]">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <Settings className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">
                {adminView === "canticos" ? "Gerenciar Cânticos" : "Gerenciar Ministros"}
              </h1>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-3">
            <button
              onClick={() => setAdminView("canticos")}
              className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 ${adminView === "canticos" ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))]"}`}
            >
              <BookOpen className="w-3.5 h-3.5" /> Cânticos
            </button>
            <button
              onClick={() => setAdminView("ministros")}
              className={`h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 ${adminView === "ministros" ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))]"}`}
            >
              <HandHeart className="w-3.5 h-3.5" /> Ministros
            </button>
          </div>
        </div>
        <div className="p-4">
          {adminView === "canticos" ? <AdminCanticos /> : <AdminCanticosMinistros />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <PageHead title="Cânticos" description="Repertório de cânticos com playbacks" path="/canticos" />

      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-[hsl(var(--dark-hover-strong))]">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-hover))]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Music2 className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Cânticos</h1>
          </div>
          {isAdmin && (
            <button
              onClick={() => setAdminView("canticos")}
              className="h-9 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium flex items-center gap-1.5"
              title="Gerenciar"
            >
              <Settings className="w-4 h-4" /> Gerenciar
            </button>
          )}
        </div>

        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por número, título ou trecho da letra…"
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))] text-sm"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              className="h-9 px-2 rounded-lg bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))] text-xs shrink-0"
            >
              <option value="">Todas categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterMinistro}
              onChange={(e) => setFilterMinistro(e.target.value)}
              className="h-9 px-2 rounded-lg bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))] text-xs shrink-0"
            >
              <option value="">Todos ministros</option>
              {ministros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin inline text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-[hsl(var(--dark-muted))]">
          <Music2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          Nenhum cântico {list.length ? "encontrado" : "cadastrado ainda"}
        </div>
      ) : (
        <ul className="p-4 space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setOpenId(c.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))] text-left hover:bg-[hsl(var(--dark-hover-strong))] transition"
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {c.numero}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.titulo}</div>
                  <div className="text-xs text-[hsl(var(--dark-muted))] flex items-center gap-2 flex-wrap mt-0.5">
                    {c.categoria && <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{c.categoria}</span>}
                    {c.tom && <span>Tom {c.tom}</span>}
                    {(c.playbacks?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{c.playbacks.length}</span>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b border-[hsl(var(--dark-hover-strong))]">
            <button onClick={() => setOpenId(null)} className="p-1.5 rounded-md hover:bg-[hsl(var(--dark-hover))]">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[hsl(var(--dark-muted))]">Cântico #{open.numero}</div>
              <div className="text-base font-semibold truncate">{open.titulo}</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {open.categoria && <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">{open.categoria}</span>}
              {open.tom && <span className="px-2 py-1 rounded-full bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))]">Tom {open.tom}</span>}
              {open.capotraste != null && <span className="px-2 py-1 rounded-full bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))]">Capo {open.capotraste}</span>}
              {open.referencia_biblica && <span className="px-2 py-1 rounded-full bg-[hsl(var(--dark-hover))] border border-[hsl(var(--dark-hover-strong))]">📖 {open.referencia_biblica}</span>}
            </div>

            {openMinistros.length > 0 && (
              <div className="text-xs text-[hsl(var(--dark-muted))] flex items-center gap-1.5 flex-wrap">
                <User className="w-3.5 h-3.5" /> {openMinistros.join(", ")}
              </div>
            )}

            {(open.playbacks?.length ?? 0) > 0 && (
              <div>
                <div className="text-xs font-semibold text-[hsl(var(--dark-muted))] uppercase mb-2">Playbacks</div>
                <div className="flex flex-wrap gap-2">
                  {open.playbacks.map((p, i) => (
                    <a
                      key={i}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> {p.label}
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2 text-base leading-relaxed">
              {(open.letra_json || []).map((b, i) => (
                <div key={i} className={b.tipo === "refrao" ? "pl-4 border-l-2 border-primary italic" : ""}>
                  {b.tipo === "verso" && (
                    <div className="text-xs font-semibold text-primary mb-1">Verso {b.numero ?? i + 1}</div>
                  )}
                  {b.tipo === "refrao" && (
                    <div className="text-xs font-semibold text-primary mb-1 uppercase">Refrão</div>
                  )}
                  {b.tipo === "ponte" && (
                    <div className="text-xs font-semibold text-primary mb-1 uppercase">Ponte</div>
                  )}
                  {b.linhas.map((l, j) => <div key={j}>{l}</div>)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}