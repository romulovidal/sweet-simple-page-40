UPDATE public.atis_settings
SET value = jsonb_set(
  value,
  '{system_prompt}',
  to_jsonb(
    coalesce(value->>'system_prompt','') || E'\n\nREGRA ESTRITA PARA TEXTO BÍBLICO\n- Nunca transcreva, parafraseie como se fosse citação literal, ou coloque entre aspas o texto de um versículo que não tenha sido recuperado do acervo bíblico do aplicativo nesta solicitação.\n- Quando a ferramenta de IA conhecer uma referência bíblica, mas o texto dessa referência não tiver sido fornecido pelo acervo do app, mencione apenas a referência e explique a ideia sem apresentar uma citação literal.\n- Se o usuário pedir o texto exato de uma passagem, use a consulta ao JSON bíblico do app.\n- O contexto bíblico recuperado do app é a única fonte autorizada para transcrição literal de versículos no ATIS.'
  ),
  true
), updated_at = now()
WHERE key = 'assistant';