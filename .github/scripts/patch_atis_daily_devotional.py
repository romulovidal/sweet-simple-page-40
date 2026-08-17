from pathlib import Path

path = Path("supabase/functions/_shared/atis/assistant.ts")
text = path.read_text()

old = '''  return clampText(guardUngroundedBibleQuotes(text, bibleContext?.text ?? null));
}'''
new = '''  const guarded = guardUngroundedBibleQuotes(text, bibleContext?.text ?? null);
  if (route === "devotional" && bibleContext) {
    const placeholder = "📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*";
    const trustedDailyVerse = `📖 *${bibleContext.label}*\\n“${bibleContext.text}”`;
    return clampText(guarded.replaceAll(placeholder, trustedDailyVerse));
  }
  return clampText(guarded);
}'''
if old not in text:
    raise SystemExit("Devotional guard return block not found")
text = text.replace(old, new, 1)

path.write_text(text)
print("ATIS devotional trusted daily verse fallback applied")
