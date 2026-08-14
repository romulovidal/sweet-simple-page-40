import React, { useState, useEffect } from "react";
import { 
  X, 
  Clock, 
  Calendar, 
  Target, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  ChevronRight,
  ShieldCheck,
  Globe,
  Loader2
} from "lucide-react";
import { atisLogDb, AtisAutomationLog, AtisAutomationAttempt } from "./atisLogDb";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AtisLogDetailsProps {
  logId: string | null;
  onClose: () => void;
}

const sanitizeJson = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJson);
  }

  const sensitiveKeys = [
    'authorization', 'token', 'access_token', 'refresh_token', 
    'api_key', 'apikey', 'secret', 'password', 'key'
  ];

  const sanitized: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = "***";
      } else {
        sanitized[key] = sanitizeJson(obj[key]);
      }
    }
  }
  return sanitized;
};

export const AtisLogDetails: React.FC<AtisLogDetailsProps> = ({ logId, onClose }) => {
  const [log, setLog] = useState<AtisAutomationLog | null>(null);
  const [attempts, setAttempts] = useState<AtisAutomationAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!logId) {
      setLog(null);
      setAttempts([]);
      return;
    }

    const loadDetails = async () => {
      setLoading(true);
      try {
        const [logData, attemptsData] = await Promise.all([
          atisLogDb.getLogDetails(logId),
          atisLogDb.getAttempts(logId)
        ]);
        setLog(logData);
        setAttempts(attemptsData);
      } catch (error) {
        console.error("Error loading log details:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [logId]);

  if (!logId) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
  };

  return (
    <Dialog open={!!logId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] bg-[hsl(var(--dark-card))] border-[hsl(var(--dark-card-hover))] text-[hsl(var(--dark-text))] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="p-6 border-b border-[hsl(var(--dark-card-hover))]">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Detalhes da Execução
            </DialogTitle>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
              <p className="text-sm text-[hsl(var(--dark-muted))]">Carregando detalhes e histórico...</p>
            </div>
          ) : log ? (
            <div className="p-6 space-y-8">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))] mb-2">Automação</h4>
                    <p className="text-sm font-bold">{log.atis_notification_configs?.name || "Desconhecida"}</p>
                    <p className="text-xs font-mono text-[hsl(var(--dark-muted))]">{log.atis_notification_configs?.source_key || "N/A"}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))] mb-2">Destinatário</h4>
                    <p className="text-sm font-mono">{log.recipient_key}</p>
                    <p className="text-xs text-[hsl(var(--dark-muted))] uppercase">{log.recipient_type}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))] mb-2">Status Atual</h4>
                    <Badge variant="outline" className="font-bold uppercase tracking-tight">
                      {log.status}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))] mb-2">Tentativas</h4>
                    <p className="text-sm font-bold">{log.attempts} execuções registradas</p>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div className="bg-[hsl(var(--dark-bg))]/50 rounded-2xl p-4 border border-[hsl(var(--dark-card-hover))] grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <h5 className="text-[10px] font-bold text-[hsl(var(--dark-muted))] mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Agendado
                  </h5>
                  <p className="text-xs">{formatDate(log.scheduled_for)}</p>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-[hsl(var(--dark-muted))] mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Claimed
                  </h5>
                  <p className="text-xs">{formatDate(log.claimed_at)}</p>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-[hsl(var(--dark-muted))] mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Processado
                  </h5>
                  <p className="text-xs">{formatDate(log.processed_at)}</p>
                </div>
                <div>
                  <h5 className="text-[10px] font-bold text-[hsl(var(--dark-muted))] mb-1 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Próximo Retry
                  </h5>
                  <p className="text-xs">{formatDate(log.next_retry_at)}</p>
                </div>
              </div>

              {/* Error Detail */}
              {log.last_error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-red-500 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <h4 className="text-xs font-bold uppercase">Último Erro Registrado</h4>
                  </div>
                  <p className="text-xs font-mono text-red-200/80 bg-black/20 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {log.last_error}
                  </p>
                </div>
              )}

              {/* Attempts Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))]">Linha do Tempo de Tentativas</h4>
                  <Badge variant="outline" className="text-[10px] opacity-60">{attempts.length} registros</Badge>
                </div>

                <div className="space-y-3">
                  {attempts.length === 0 ? (
                    <div className="text-center py-8 text-[hsl(var(--dark-muted))] text-xs italic">
                      Nenhum registro de tentativa detalhada encontrado.
                    </div>
                  ) : (
                    attempts.map((attempt) => (
                      <div 
                        key={attempt.id} 
                        className="bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] rounded-xl p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                              {attempt.attempt_number}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-tight">Tentativa #{attempt.attempt_number}</span>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={`text-[10px] ${
                              attempt.status === 'success' ? 'text-green-500 border-green-500/20 bg-green-500/5' : 
                              attempt.status === 'retrying' ? 'text-orange-500 border-orange-500/20 bg-orange-500/5' :
                              'text-red-500 border-red-500/20 bg-red-500/5'
                            }`}
                          >
                            {attempt.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-[10px] text-[hsl(var(--dark-muted))] border-t border-[hsl(var(--dark-card-hover))] pt-2">
                          <div>
                            <span className="block font-bold mb-0.5 uppercase opacity-60">Início</span>
                            {formatDate(attempt.created_at)}
                          </div>
                        </div>

                        {attempt.error_message && (
                          <p className="text-[11px] text-red-400 font-medium bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                            {attempt.error_message}
                          </p>
                        )}

                        {attempt.response_payload && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold uppercase text-[hsl(var(--dark-muted))] opacity-60">Resposta do Provedor (Sanitizada)</span>
                            <pre className="text-[10px] font-mono p-3 rounded-lg bg-black/30 overflow-x-auto text-blue-200/80">
                              {JSON.stringify(sanitizeJson(attempt.response_payload), null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Technical Metadata */}
              <div className="pt-4 border-t border-[hsl(var(--dark-card-hover))]">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-primary opacity-50" />
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[hsl(var(--dark-muted))]">Dados Técnicos</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[10px] font-mono text-[hsl(var(--dark-muted))]">
                  <div className="flex justify-between border-b border-[hsl(var(--dark-card-hover))] py-1">
                    <span>ID do Log:</span>
                    <span className="text-[hsl(var(--dark-text))]">{log.id}</span>
                  </div>
                  <div className="flex justify-between border-b border-[hsl(var(--dark-card-hover))] py-1">
                    <span>Worker ID:</span>
                    <span className="text-[hsl(var(--dark-text))]">{log.worker_id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-[hsl(var(--dark-card-hover))] py-1">
                    <span>External ID:</span>
                    <span className="text-[hsl(var(--dark-text))]">{log.message_sent_id || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-[hsl(var(--dark-card-hover))] py-1">
                    <span>Idempotency Key:</span>
                    <span className="text-[hsl(var(--dark-text))] truncate max-w-[150px]">{log.idempotency_key}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-red-500">
              Erro ao carregar os detalhes do registro.
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

const RotateCcw = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);
