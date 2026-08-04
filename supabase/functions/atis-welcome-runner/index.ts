import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { evolutionSendText, firstName } from '../_shared/atis-evolution.ts';
import { safeSend, loadGuard, humanGap, shuffle } from '../_shared/atis-antiban.ts';

const DEFAULT_TEMPLATE = `👋 Olá, {nome}!

Bem-vindo(a) ao Atis, o assistente da *Bíblia Atalaia*. A partir de agora você pode receber por aqui:

📖 Versículo do dia
💜 Devocionais e reflexões
🙏 Pedidos de oração
🎂 Lembretes especiais

Você pode a qualquer momento:
• Mandar uma referência (ex: *João 3:16*) para receber o texto
• Pedir uma *reflexão devocional* sobre um versículo
• Perguntar sobre a Bíblia — respondo com carinho

Se quiser parar de receber, é só responder *sair*.

— Igreja Atalaias de Betel`;

function applyTemplate(tpl: string, nome: string): string {
  return tpl.replaceAll('{nome}', nome);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: settingRow } = await admin.from('admin_settings').select('value').eq('key', 'atis_welcome').maybeSingle();
  const cfg = (settingRow?.value ?? {}) as { enabled?: boolean; template?: string | null };
  if (cfg.enabled === false) {
    return new Response(JSON.stringify({ skipped: true, reason: 'disabled' }), { headers: corsHeaders });
  }
  const template = (cfg.template && cfg.template.trim()) ? cfg.template! : DEFAULT_TEMPLATE;

  const targets: Array<{ kind: 'profile' | 'contact'; id: string; phone: string; name: string | null }> = [];

  const { data: profs } = await admin
    .from('profiles')
    .select('user_id, display_name, whatsapp, whatsapp_opt_in, atis_welcomed_at')
    .eq('whatsapp_opt_in', true)
    .is('atis_welcomed_at', null)
    .not('whatsapp', 'is', null);
  for (const p of profs ?? []) {
    const phone = String((p as any).whatsapp ?? '').replace(/\D/g, '');
    if (phone) targets.push({ kind: 'profile', id: (p as any).user_id, phone, name: (p as any).display_name });
  }

  const { data: contacts } = await admin
    .from('atis_contacts')
    .select('id, name, phone, opt_in, welcomed_at')
    .eq('opt_in', true)
    .is('welcomed_at', null);
  for (const c of contacts ?? []) {
    const phone = String((c as any).phone ?? '').replace(/\D/g, '');
    if (phone) targets.push({ kind: 'contact', id: (c as any).id, phone, name: (c as any).name });
  }

  if (!targets.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { headers: corsHeaders });

  const results: any[] = [];
  const now = new Date().toISOString();
  const guard = await loadGuard(admin);
  let idx = 0;
  for (const t of shuffle(targets)) {
    await humanGap(guard, idx++);
    const nome = firstName(t.name);
    const text = applyTemplate(template, nome);
    const r = await safeSend(admin, t.phone, text, { kind: 'transactional' });
    if ((r as any).skipped) { results.push({ kind: t.kind, phone: t.phone, ok: false, skipped: (r as any).reason }); continue; }
    await admin.from('atis_messages_log').insert({
      direction: 'outbound', wa_to: t.phone, body: text,
      command: 'welcome', status: r.ok ? 'sent' : 'error',
      raw: { kind: t.kind, http: r.status },
    });
    if (r.ok) {
      if (t.kind === 'profile') {
        await admin.from('profiles').update({ atis_welcomed_at: now }).eq('user_id', t.id);
      } else {
        await admin.from('atis_contacts').update({ welcomed_at: now }).eq('id', t.id);
      }
    }
    results.push({ kind: t.kind, phone: t.phone, ok: r.ok, status: r.status });
  }

  return new Response(JSON.stringify({ ok: true, sent: results.filter((r) => r.ok).length, total: results.length, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});