import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Normaliza um identificador de destinatário para o formato canônico do WhatsApp.
 * Regras:
 * - Grupos (@g.us) permanecem intactos.
 * - Telefones individuais são limpos e recebem DDI 55 (Brasil) e sufixo @s.whatsapp.net.
 */
export function normalizeRecipient(to: string): { key: string; isGroup: boolean } {
  if (!to) return { key: '', isGroup: false };
  
  const target = to.trim();
  const isGroup = target.endsWith('@g.us');
  
  if (isGroup) {
    return { key: target, isGroup: true };
  }
  
  // Limpa caracteres não numéricos, preservando o sufixo se já existir
  const base = target.includes('@') ? target.split('@')[0] : target;
  const digits = base.replace(/\D/g, '');
  
  if (!digits) return { key: target, isGroup: false };
  
  // Garante DDI 55 se parecer um número brasileiro sem DDI
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  
  return { 
    key: `${withCountry}@s.whatsapp.net`, 
    isGroup: false 
  };
}

export interface ResolvedRecipient {
  recipientType: 'individual' | 'group';
  recipientKey: string; // JID canônico
  sourceTargetId?: string;
  phone?: string;
  jid?: string;
  displayName?: string;
  metadata?: any;
}

/**
 * Resolve target_type (profile, contact, group, tag, etc.) em uma lista de destinatários finais.
 */
export async function resolveAtisRecipients(
  supabase: any,
  configId: string,
  targetType: string,
  targetId: string
): Promise<ResolvedRecipient[]> {
  const recipients: ResolvedRecipient[] = [];

  switch (targetType) {
    case 'jid_individual': {
      const { key } = normalizeRecipient(targetId);
      recipients.push({
        recipientType: 'individual',
        recipientKey: key,
        jid: key
      });
      break;
    }

    case 'group': {
      // Busca JID real na tabela atis_groups se targetId for UUID
      let jid = targetId;
      if (!targetId.endsWith('@g.us')) {
        const { data } = await supabase
          .from('atis_groups')
          .select('wa_group_id, name')
          .eq('id', targetId)
          .maybeSingle();
        if (data?.wa_group_id) {
          jid = data.wa_group_id;
        }
      }
      
      const { key } = normalizeRecipient(jid);
      recipients.push({
        recipientType: 'group',
        recipientKey: key,
        jid: key
      });
      break;
    }

    case 'contact': {
      const { data } = await supabase
        .from('atis_contacts')
        .select('phone, name')
        .eq('id', targetId)
        .maybeSingle();
      
      if (data?.phone) {
        const { key } = normalizeRecipient(data.phone);
        recipients.push({
          recipientType: 'individual',
          recipientKey: key,
          displayName: data.name
        });
      }
      break;
    }

    case 'profile': {
      const { data } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .eq('id', targetId)
        .maybeSingle();
      
      if (data?.phone) {
        const { key } = normalizeRecipient(data.phone);
        recipients.push({
          recipientType: 'individual',
          recipientKey: key,
          displayName: data.full_name
        });
      }
      break;
    }

    case 'tag': {
      const { data } = await supabase
        .from('atis_contacts')
        .select('phone, name')
        .contains('tags', [targetId])
        .eq('opt_in', true);
      
      if (data) {
        for (const contact of data) {
          const { key } = normalizeRecipient(contact.phone);
          recipients.push({
            recipientType: 'individual',
            recipientKey: key,
            displayName: contact.name
          });
        }
      }
      break;
    }

    case 'all_authenticated': {
      const { data } = await supabase
        .from('profiles')
        .select('phone, full_name')
        .not('phone', 'is', null);
      
      if (data) {
        for (const profile of data) {
          const { key } = normalizeRecipient(profile.phone);
          recipients.push({
            recipientType: 'individual',
            recipientKey: key,
            displayName: profile.full_name
          });
        }
      }
      break;
    }
  }

  return recipients;
}
