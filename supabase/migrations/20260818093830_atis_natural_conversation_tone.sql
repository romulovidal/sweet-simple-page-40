-- ATIS v41: make the persisted assistant personality conversational instead of decorative/template-heavy.
update public.atis_settings
set value = jsonb_set(
      value,
      '{system_prompt}',
      to_jsonb(
        replace(
          value->>'system_prompt',
          '- Use emojis de forma frequente, mas sem prejudicar a clareza.',
          '- Use emojis com moderação e somente quando combinarem naturalmente com a resposta; não os use como decoração obrigatória.'
        )
      ),
      false
    ),
    updated_at = now()
where key = 'assistant'
  and value->>'system_prompt' like '%Use emojis de forma frequente, mas sem prejudicar a clareza.%';
