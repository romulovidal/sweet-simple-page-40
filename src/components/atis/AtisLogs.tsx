import { useEffect, useState, useMemo } from "react";
import { 
  Loader2, 
  Search, 
  Filter, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  RotateCcw,
  Info,
  History,
  AlertTriangle
} from "lucide-react";
import { atisLogDb, AtisAutomationLog, AtisLogStatus } from "./atisLogDb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AtisLogDetails } from "./AtisLogDetails";

const PAGE_SIZE = 25;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  scheduled: { label: "Agendado", color: "bg-slate-500/10 text-slate-500 border-slate-500/20", icon: Clock },
  pending: { label: "Pendente", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", icon: Clock },
  processing: { label: "Processando", color: "bg-primary/10 text-primary border-primary/20", icon: Loader2 },
  retrying: { label: "Em Retry", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", icon: RotateCcw },
  sent: { label: "Enviado", color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle2 },
  failed: { label: "Falhou", color: "bg-red-500/10 text-red-500 border-red-500/20", icon: AlertCircle },
  skipped: { label: "Ignorado", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", icon: Info },
  postponed: { label: "Adiado", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", icon: History },
};

const AtisLogs = () => {
  const [logs, setLogs] = useState<AtisAutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [configFilter, setConfigFilter] = useState<string>("all");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [configs, setConfigs] = useState<{id: string, name: string, source_key: string | null}[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, count } = await atisLogDb.getLogs(page, PAGE_SIZE, {
        status: statusFilter === "all" ? undefined : [statusFilter],
        configId: configFilter === "all" ? undefined : configFilter,
        recipient: recipientSearch || undefined
      });
      setLogs(data);
      setTotalCount(count);

      const configsList = await atisLogDb.getConfigsList();
      setConfigs(configsList);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, statusFilter, configFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadData();
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || { 
      label: status, 
      color: "bg-slate-500/10 text-slate-500 border-slate-500/20", 
      icon: AlertTriangle 
    };
    const Icon = config.icon;

    return (
      <Badge variant="outline" className={`gap-1.5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
        <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <form onSubmit={handleSearch} className="md:col-span-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--dark-muted))]" />
            <Input 
              value={recipientSearch} 
              onChange={e => setRecipientSearch(e.target.value)} 
              placeholder="Destinatário..." 
              className="pl-9 bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]"
            />
          </div>
          <Button type="submit" size="icon" variant="outline" className="shrink-0 bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]">
            <Search className="w-4 h-4" />
          </Button>
        </form>

        <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(0); }}>
          <SelectTrigger className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))]">
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={configFilter} onValueChange={(val) => { setConfigFilter(val); setPage(0); }}>
          <SelectTrigger className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))]">
            <SelectValue placeholder="Automação" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))]">
            <SelectItem value="all">Todas as Automações</SelectItem>
            {configs.map((config) => (
              <SelectItem key={config.id} value={config.id}>{config.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button 
          onClick={() => { setPage(0); loadData(); }} 
          variant="outline" 
          className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] gap-2"
        >
          <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="rounded-2xl bg-[hsl(var(--dark-card))] border border-[hsl(var(--dark-card-hover))] overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
            <p className="text-sm text-[hsl(var(--dark-muted))]">Carregando logs operacionais...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-8 h-8 mx-auto text-[hsl(var(--dark-muted))] opacity-20 mb-3" />
            <p className="text-sm text-[hsl(var(--dark-muted))] font-medium">Nenhum log encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[hsl(var(--dark-bg))] text-[hsl(var(--dark-muted))] border-b border-[hsl(var(--dark-card-hover))]">
                  <th className="px-4 py-4 font-bold uppercase tracking-wider">Automação / Source</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider">Destinatário</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-center">Status</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider">Agendado</th>
                  <th className="px-4 py-4 font-bold uppercase tracking-wider text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--dark-card-hover))]">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-[hsl(var(--dark-bg))]/50 transition-colors group">
                    <td className="px-4 py-4">
                      <p className="font-bold text-[hsl(var(--dark-text))]">
                        {log.atis_notification_configs?.name || "Automação não encontrada"}
                      </p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))] font-mono mt-0.5">
                        {log.atis_notification_configs?.source_key || "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-mono text-[hsl(var(--dark-text))]">{log.recipient_key}</p>
                      <p className="text-[10px] text-[hsl(var(--dark-muted))] uppercase tracking-tight">{log.recipient_type}</p>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="inline-block">
                        {getStatusBadge(log.status)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[hsl(var(--dark-muted))] leading-tight">
                      <p className="font-bold text-[hsl(var(--dark-text))]">
                        {format(new Date(log.scheduled_for), "HH:mm", { locale: ptBR })}
                      </p>
                      <p className="text-[9px]">
                        {format(new Date(log.scheduled_for), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button 
                        onClick={() => setSelectedLogId(log.id)}
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 hover:bg-primary/10 text-primary rounded-xl"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <p className="text-xs text-[hsl(var(--dark-muted))]">
            Mostrando <span className="text-[hsl(var(--dark-text))] font-bold">{logs.length}</span> de <span className="text-[hsl(var(--dark-text))] font-bold">{totalCount}</span> logs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage(p => p - 1)}
              className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] h-8 px-2 rounded-xl"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <div className="text-xs font-bold text-[hsl(var(--dark-muted))] px-2">
              Página <span className="text-primary">{page + 1}</span> de {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage(p => p + 1)}
              className="bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] h-8 px-2 rounded-xl"
            >
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      <AtisLogDetails 
        logId={selectedLogId} 
        onClose={() => setSelectedLogId(null)} 
      />
    </div>
  );
};

export default AtisLogs;

