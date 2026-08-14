import { atisDb } from "./atisDb";

export type AtisLogStatus = 
  | 'scheduled' 
  | 'pending' 
  | 'processing' 
  | 'retrying' 
  | 'sent' 
  | 'failed' 
  | 'skipped' 
  | 'postponed';

export interface AtisAutomationLog {
  id: string;
  config_id: string;
  source_target_id: string | null;
  recipient_type: 'individual' | 'group';
  recipient_key: string;
  occurrence_key: string;
  idempotency_key: string;
  status: AtisLogStatus;
  scheduled_for: string;
  worker_id: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  last_error: string | null;
  processed_at: string | null;
  message_sent_id: string | null;
  created_at: string;
  updated_at: string;
  // Join fields
  atis_notification_configs?: {
    name: string;
    source_key: string | null;
  };
}

export interface AtisAutomationAttempt {
  id: string;
  log_id: string;
  attempt_number: number;
  status: 'success' | 'error' | 'retrying' | 'skipped';
  error_message: string | null;
  response_payload: any;
  created_at: string;
}

export const atisLogDb = {
  async getLogs(page = 0, pageSize = 25, filters: {
    status?: string[];
    configId?: string;
    startDate?: Date;
    endDate?: Date;
    recipient?: string;
  } = {}) {
    let query = atisDb
      .from("atis_automation_logs")
      .select(`
        *,
        atis_notification_configs (
          name,
          source_key
        )
      `, { count: 'exact' });

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }
    if (filters.configId) {
      query = query.eq("config_id", filters.configId);
    }
    if (filters.startDate) {
      query = query.gte("scheduled_for", filters.startDate.toISOString());
    }
    if (filters.endDate) {
      query = query.lte("scheduled_for", filters.endDate.toISOString());
    }
    if (filters.recipient) {
      query = query.ilike("recipient_key", `%${filters.recipient}%`);
    }

    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order("scheduled_for", { ascending: false })
      .range(from, to);

    if (error) throw error;
    return { data: (data as AtisAutomationLog[]) || [], count: count || 0 };
  },

  async getLogDetails(id: string): Promise<AtisAutomationLog> {
    const { data, error } = await atisDb
      .from("atis_automation_logs")
      .select(`
        *,
        atis_notification_configs (
          name,
          source_key
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;
    return data as AtisAutomationLog;
  },

  async getAttempts(logId: string): Promise<AtisAutomationAttempt[]> {
    const { data, error } = await atisDb
      .from("atis_automation_attempts")
      .select("*")
      .eq("log_id", logId)
      .order("attempt_number", { ascending: true });

    if (error) throw error;
    return (data as AtisAutomationAttempt[]) || [];
  },

  async getConfigsList() {
    const { data, error } = await atisDb
      .from("atis_notification_configs")
      .select("id, name, source_key")
      .order("name");
    
    if (error) throw error;
    return data || [];
  }
};
