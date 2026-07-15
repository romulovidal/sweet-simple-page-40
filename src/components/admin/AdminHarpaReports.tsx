import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Report = {
  id: string;
  hino_number: number;
  hino_title: string;
  message: string;
  user_id: string | null;
  status: "open" | "resolved";
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
};

type Filter = "open" | "resolved" | "all";

export default function AdminHarpaReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("harpa_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error("Erro ao carregar relatos");
    setReports((data as Report[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((r) => r.status === filter);
  }, [reports, filter]);

  const counts = useMemo(
    () => ({
      open: reports.filter((r) => r.status === "open").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
      all: reports.length,
    }),
    [reports]
  );

  async function markResolved(r: Report) {
    setBusyId(r.id);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("harpa_reports")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: userData.user?.id ?? null,
      })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error("Não foi possível atualizar");
    toast.success("Marcado como resolvido");
    load();
  }

  async function reopen(r: Report) {
    setBusyId(r.id);
    const { error } = await supabase
      .from("harpa_reports")
      .update({ status: "open", resolved_at: null, resolved_by: null })
      .eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error("Não foi possível atualizar");
    load();
  }

  async function remove(r: Report) {
    if (!confirm(`Excluir o relato do hino ${r.hino_number}?`)) return;
    setBusyId(r.id);
    const { error } = await supabase.from("harpa_reports").delete().eq("id", r.id);
    setBusyId(null);
    if (error) return toast.error("Não foi possível excluir");
    toast.success("Relato excluído");
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {(["open", "resolved", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
            }`}
          >
            {f === "open" ? "Abertos" : f === "resolved" ? "Resolvidos" : "Todos"}
            <span className="ml-1.5 opacity-70">({counts[f]})</span>
          </button>
        ))}
        <button
          onClick={load}
          className="ml-auto p-2 rounded-full bg-[hsl(var(--dark-card))] text-[hsl(var(--dark-muted))] hover:text-[hsl(var(--dark-text))]"
          aria-label="Recarregar"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-[hsl(var(--dark-muted))] text-sm">
          Nenhum relato {filter === "open" ? "aberto" : filter === "resolved" ? "resolvido" : ""}.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((r) => {
            const isOpen = r.status === "open";
            return (
              <li
                key={r.id}
                className={`rounded-2xl p-4 border ${
                  isOpen
                    ? "bg-[hsl(var(--dark-card))] border-[hsl(var(--destructive))]/30"
                    : "bg-[hsl(var(--dark-card))]/60 border-[hsl(var(--dark-card-hover))]"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full ${
                          isOpen
                            ? "bg-[hsl(var(--destructive))]/15 text-[hsl(var(--destructive))]"
                            : "bg-emerald-500/15 text-emerald-400"
                        }`}
                      >
                        {isOpen ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {isOpen ? "Aberto" : "Resolvido"}
                      </span>
                      <span className="text-[11px] text-[hsl(var(--dark-muted))]">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-[hsl(var(--dark-text))] truncate">
                      Hino {r.hino_number} — {r.hino_title}
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[hsl(var(--dark-text))] whitespace-pre-wrap leading-relaxed">
                  {r.message}
                </p>

                <div className="mt-2 text-[11px] text-[hsl(var(--dark-muted))]">
                  {r.user_id ? `Usuário: ${r.user_id.slice(0, 8)}…` : "Envio anônimo"}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[hsl(var(--dark-card-hover))]">
                  {isOpen ? (
                    <button
                      onClick={() => markResolved(r)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Marcar resolvido
                    </button>
                  ) : (
                    <button
                      onClick={() => reopen(r)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] text-xs font-semibold hover:opacity-80 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reabrir
                    </button>
                  )}
                  <button
                    onClick={() => remove(r)}
                    disabled={busyId === r.id}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10 text-xs font-semibold disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}