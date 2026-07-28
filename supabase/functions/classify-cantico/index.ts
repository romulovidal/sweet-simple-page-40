import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { aiChatFetch } from '../_shared/ai-fetch.ts'

// Recebe { titulo, letra } e devolve { letra_json, categoria }
// letra_json: array de blocos { tipo: 'verso' | 'refrao' | 'ponte', numero?: number, linhas: string[] }
// categoria: Louvor | Adoração | Ceia | Batismo | Natal | Apelo | Consagração | Testemunho | Guerra Espiritual | Outros

const SYSTEM = `Você é um assistente que estrutura letras de cânticos evangélicos em JSON e classifica em categorias.

SEMPRE responda com JSON válido puro (sem markdown, sem \`\`\`), no formato:
{
  "categoria": "<uma das opções>",
  "letra_json": [
    { "tipo": "verso", "numero": 1, "linhas": ["linha 1", "linha 2", "..."] },
    { "tipo": "refrao", "linhas": ["..."] },
    { "tipo": "ponte", "linhas": ["..."] }
  ]
}

Regras:
- Preserve o texto original palavra por palavra (apenas corrija maiúsculas de início de linha e pontuação óbvia).
- Identifique refrão pela repetição textual ou por marcadores como "Coro:", "Refrão:", "Bis".
- Numere apenas os versos (1, 2, 3...). Refrão e ponte não recebem número.
- Categorias possíveis: "Louvor", "Adoração", "Ceia", "Batismo", "Natal", "Apelo", "Consagração", "Testemunho", "Guerra Espiritual", "Ação de Graças", "Oração", "Outros".
- Escolha a categoria que MELHOR representa o tema principal.
- Responda APENAS o JSON, nada mais.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { titulo, letra } = await req.json()
    if (!letra || typeof letra !== 'string' || letra.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Letra muito curta' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const user = `Título: ${titulo || '(sem título)'}\n\nLetra:\n${letra}`

    const res = await aiChatFetch({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('[classify-cantico] provider error', res.status, errText.slice(0, 300))
      return new Response(JSON.stringify({ error: 'Falha na IA', detail: errText.slice(0, 300) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const j = await res.json() as any
    const raw = j?.choices?.[0]?.message?.content ?? ''
    let parsed: any = null
    try {
      const cleaned = String(raw).trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '')
      parsed = JSON.parse(cleaned)
    } catch {
      // tentar extrair objeto JSON de dentro do texto
      const match = String(raw).match(/\{[\s\S]*\}/)
      if (match) {
        try { parsed = JSON.parse(match[0]) } catch { /* ignore */ }
      }
    }

    if (!parsed || !Array.isArray(parsed.letra_json)) {
      return new Response(JSON.stringify({ error: 'Resposta inválida da IA', raw: String(raw).slice(0, 400) }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      categoria: parsed.categoria || 'Outros',
      letra_json: parsed.letra_json,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[classify-cantico] threw', (e as Error).message)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})