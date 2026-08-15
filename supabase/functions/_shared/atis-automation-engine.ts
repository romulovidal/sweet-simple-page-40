import { createClient } from 'npm:@supabase/supabase-js@2';
import { safeSend as legacySafeSend, humanGap as legacyHumanGap } from './atis-antiban.ts';
import { resolveAtisRecipients, type ResolvedRecipient } from './atis-recipient-resolver.ts';

/**
 * ATIS V2 Engine - Core Logic
 * Centraliza configuração, claim, idempotência e orquestração.
 */

export interface AutomationResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  logId?: string;
  messageId?: string;
  error?: string;
}

export class AtisEngine {
  private supabase: any;
  private workerId: string;

  constructor(supabase: any, workerName: string) {
    this.supabase = supabase;
    this.workerId = `${workerName}:${crypto.randomUUID()}`;
  }

  /**
   * Obtém a timezone correta (Config > Global > Default)
   */
  async getTimezone(configTz?: string | null): Promise<string> {
    if (configTz) return configTz;
    const { data } = await this.supabase
      .from('atis_automation_settings')
      .select('timezone')
      .eq('id', 1)
      .maybeSingle();
    return data?.timezone ?? 'America/Fortaleza';
  }

  /**
   * Verifica se o motor global está ativado
   */
  async isGlobalEnabled(): Promise<boolean> {
    const { data } = await this.supabase
      .from('atis_automation_settings')
      .select('global_enabled')
      .eq('id', 1)
      .maybeSingle();
    return data?.global_enabled !== false;
  }

  /**
   * Processa uma configuração de automação para todos os seus targets.
   */
  async runConfig(configId: string | null, occurrenceKey?: string) {
    if (!(await this.isGlobalEnabled())) {
      console.log(`[AtisEngine] Global disabled. Skipping config ${configId}`);
      return;
    }

    const { data: config, error } = await this.supabase
      .from('atis_notification_configs')
      .select('*, atis_notification_targets(*)')
      .eq('id', configId)
      .eq('enabled', true)
      .maybeSingle();

    if (error || !config) {
      console.log(`[AtisEngine] Config ${configId} not found or disabled.`);
      return;
    }

    const tz = await this.getTimezone(config.timezone);
    const now = new Date();
    
    for (const target of config.atis_notification_targets) {
      if (!target.active) continue;
      
      const recipients = await resolveAtisRecipients(
        this.supabase,
        configId,
        target.target_type,
        target.target_id
      );

      for (const recipient of recipients) {
        await this.processRecipient(config, recipient, occurrenceKey ?? this.generateOccurrenceKey(now, tz));
      }
    }
  }

  private generateOccurrenceKey(date: Date, tz: string): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:00`;
  }

  /**
   * Garante o log de idempotência, faz o claim e envia.
   */
  async processRecipient(
    config: any, 
    recipient: ResolvedRecipient, 
    occurrenceKey: string,
    messageOverride?: string,
    metadata?: any
  ): Promise<AutomationResult> {

    const idempotencyKey = `${config.id}:${recipient.recipientKey}:${occurrenceKey}`;
    
    // 1. Garantir log (Idempotência Canônica)
    const { data: log, error: logError } = await this.supabase
      .from('atis_automation_logs')
      .upsert({
        config_id: config.id,
        recipient_type: recipient.recipientType,
        recipient_key: recipient.recipientKey,
        occurrence_key: occurrenceKey,
        idempotency_key: idempotencyKey,
        status: 'scheduled',
        scheduled_for: new Date().toISOString(),
      }, { onConflict: 'idempotency_key' })
      .select()
      .single();

    if (logError || !log) {
      return { ok: false, error: `Failed to ensure log: ${logError?.message}` };
    }

    if (['sent', 'failed', 'skipped'].includes(log.status)) {
      return { ok: false, skipped: true, reason: 'already_processed', logId: log.id };
    }

    // 2. Claim atômico
    const { data: claimedLog, error: claimError } = await this.supabase.rpc(
      'atis_claim_automation_occurrence',
      { 
        _log_id: log.id, 
        _worker_id: this.workerId,
        _lease_minutes: 5
      }
    );

    if (claimError || !claimedLog) {
      return { ok: false, skipped: true, reason: 'claim_failed', logId: log.id };
    }

    // 3. Preparar Mensagem
    let message = messageOverride || config.message_template || '';
    
    // 4. Envio Seguro (Antiban + Evolution)
    try {
      console.log(`[AtisEngine] Attempting send to ${recipient.recipientKey} for config ${config.name}`);
      const sendResult = await legacySafeSend(
        this.supabase,
        recipient.recipientKey,
        message,
        {
          kind: config.notification_type === 'welcome' ? 'transactional' : 'bulk',
          noFooter: config.metadata?.no_footer === true,
          mentionsEveryOne: metadata?.mentionsEveryOne ?? false,
          isManual: config.automation_mode === 'manual'
        }
      );

      console.log(`[AtisEngine] Send result for ${recipient.recipientKey}:`, sendResult.ok ? 'SUCCESS' : 'FAILED', sendResult.reason || '');


      // 5. Registrar Tentativa
      await this.supabase.from('atis_automation_attempts').insert({
        log_id: log.id,
        attempt_number: (log.attempts ?? 0) + 1,
        status: sendResult.ok ? 'success' : (sendResult.skipped ? 'skipped' : 'error'),
        error_message: sendResult.reason || String(sendResult.body),
        response_payload: sendResult.body
      });

      // 6. Atualizar Log Final
      const status = sendResult.ok ? 'sent' : (sendResult.skipped ? 'skipped' : 'failed');
      
      // Se for automático e falhou por quiet_hours, agendar retry para o fim do horário de silêncio
      let nextRetryAt = null;
      let finalStatus = status;
      
      if (sendResult.skipped && sendResult.reason === 'quiet_hours' && config.automation_mode === 'automatic') {
        finalStatus = 'retrying';
        const { data: settings } = await this.supabase.from('atis_automation_settings').select('quiet_hours_end').eq('id', 1).single();
        const endStr = settings?.quiet_hours_end || '07:00';
        const [h, m] = endStr.split(':').map(Number);
        const retryDate = new Date();
        retryDate.setHours(h, m, 0, 0);
        if (retryDate <= new Date()) retryDate.setDate(retryDate.getDate() + 1);
        nextRetryAt = retryDate.toISOString();
      }

      await this.supabase.from('atis_automation_logs').update({
        status: finalStatus,
        processed_at: sendResult.ok ? new Date().toISOString() : null,
        message_sent_id: sendResult.jid,
        last_error: sendResult.ok ? null : (sendResult.reason || String(sendResult.body)),
        next_retry_at: nextRetryAt,
        attempts: (log.attempts ?? 0) + 1
      }).eq('id', log.id);

      return { 
        ok: sendResult.ok, 
        skipped: sendResult.skipped, 
        reason: sendResult.reason, 
        logId: log.id, 
        messageId: sendResult.jid 
      };

    } catch (e) {
      await this.supabase.from('atis_automation_logs').update({
        status: 'failed',
        last_error: String(e)
      }).eq('id', log.id);
      
      return { ok: false, error: String(e), logId: log.id };
    }
  }
}
