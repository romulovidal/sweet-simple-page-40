from pathlib import Path

path = Path("supabase/functions/_shared/atis/assistant.ts")
text = path.read_text()

old_classifier = '''      { role: "system", content: `${systemPrompt}\\n\\nVocê está apenas classificando intenção. Use o histórico somente para entender referências e continuidade. Retorne SOMENTE um identificador desta lista: ${allowed.join(", ")}. Não responda a pergunta.` },
      ...history.slice(-8),
      { role: "user", content: userMessage },
'''
new_classifier = '''      { role: "system", content: `${systemPrompt}\\n\\nVocê está apenas classificando intenção. Use o histórico somente para entender referências e continuidade. Retorne SOMENTE um identificador desta lista: ${allowed.join(", ")}. Não responda a pergunta.` },
      ...history.slice(-8),
      { role: "user", content: message },
'''
if old_classifier not in text:
    raise SystemExit("Classifier repair block not found")
text = text.replace(old_classifier, new_classifier, 1)

old_generation = '''    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: message },
    ],
    temperature: 0.55,
'''
new_generation = '''    messages: [
      { role: "system", content: system },
      ...history,
      { role: "user", content: userMessage },
    ],
    temperature: 0.55,
'''
if old_generation not in text:
    raise SystemExit("Devotional generation repair block not found")
text = text.replace(old_generation, new_generation, 1)

path.write_text(text)
print("ATIS devotional message wiring repaired")
