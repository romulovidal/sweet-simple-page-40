from pathlib import Path

# Fix JSX structure in the unanswered-question card.
p = Path('src/components/admin/atis/AtisHistory.tsx')
s = p.read_text()
old = 'Resposta registrada: {row.answer}</p><div className="flex gap-2 mt-3">'
new = 'Resposta registrada: {row.answer}</p>}<div className="flex gap-2 mt-3">'
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)

# Evolution 2.3.7 has known delivery problems with interactive buttons in some Baileys installations.
# Keep the feature available, but opt-in instead of enabled by default.
p = Path('supabase/migrations/20260817151000_atis_conversation_capabilities.sql')
s = p.read_text().replace('enable_buttons boolean not null default true,', 'enable_buttons boolean not null default false,')
p.write_text(s)

p = Path('supabase/functions/_shared/atis/conversation-runtime.ts')
s = p.read_text().replace('    enable_buttons: true,', '    enable_buttons: false,')
p.write_text(s)

p = Path('supabase/functions/atis-console/index.ts')
s = p.read_text().replace('    enable_buttons: true,', '    enable_buttons: false,').replace('    enable_buttons: raw.enable_buttons !== false,', '    enable_buttons: raw.enable_buttons === true,')
p.write_text(s)

p = Path('src/components/admin/atis/AtisConversationProfile.tsx')
s = p.read_text()
s = s.replace('subtitle="Mostra atalhos como Modo Estudo, Devocional e Abrir app"', 'subtitle="Experimental na Evolution 2.3.7; deixe desligado salvo teste controlado"')
p.write_text(s)

# Make Bible lookup genuinely conversational for short follow-ups such as
# “e o 17?”, “próximo versículo” or “capítulo 4?” after a Bible answer.
p = Path('supabase/functions/_shared/atis/assistant.ts')
s = p.read_text()
marker = '\nfunction bibleText(reference: BibleReference, wholeChapter = false) {'
if 'function parseBibleFollowupReference(' not in s:
    assert marker in s
    helper = r'''
function parseBibleFollowupReference(message: string, bible: BibleBook[], history: AtisConversationMessage[]): BibleReference | null {
  const q = normalize(message);
  const hasCue = /\b(versiculo|verso|capitulo|seguinte|proximo)\b/.test(q)
    || /^(?:e\s+)?(?:o\s+)?\d{1,3}(?:\s*[-–]\s*\d{1,3})?$/.test(q);
  if (!hasCue) return null;

  let base: BibleReference | null = null;
  for (const item of [...history].reverse()) {
    if (item.role !== "assistant") continue;
    const match = item.content.match(/📖\s*\*([^*\n]+)\*/u);
    if (!match) continue;
    const candidate = match[1].replace(/\s+—.*$/u, "").trim();
    base = parseBibleReference(candidate, bible);
    if (base) break;
  }
  if (!base) return null;

  const chapterMatch = q.match(/\bcapitulo\s+(\d{1,3})\b/);
  if (chapterMatch) {
    const chapter = Number(chapterMatch[1]);
    if (chapter >= 1 && chapter <= base.book.chapters.length) return { book: base.book, bookName: base.bookName, chapter };
    return null;
  }

  if (/\b(proximo|seguinte)\s+capitulo\b/.test(q)) {
    const chapter = base.chapter + 1;
    if (chapter <= base.book.chapters.length) return { book: base.book, bookName: base.bookName, chapter };
    return null;
  }

  const rangeMatch = q.match(/(?:\b(?:versiculo|verso|v)\s*)?(\d{1,3})\s*[-–]\s*(\d{1,3})\b/);
  if (rangeMatch) {
    const verseStart = Number(rangeMatch[1]);
    const verseEnd = Number(rangeMatch[2]);
    const verses = base.book.chapters[base.chapter - 1] ?? [];
    if (verseStart >= 1 && verseEnd >= verseStart && verseEnd <= verses.length) {
      return { book: base.book, bookName: base.bookName, chapter: base.chapter, verseStart, verseEnd };
    }
    return null;
  }

  if (/\b(proximo|seguinte)\s+(versiculo|verso)\b/.test(q)) {
    const current = base.verseEnd ?? base.verseStart;
    if (!current) return null;
    const verse = current + 1;
    const verses = base.book.chapters[base.chapter - 1] ?? [];
    if (verse <= verses.length) return { book: base.book, bookName: base.bookName, chapter: base.chapter, verseStart: verse, verseEnd: verse };
    return null;
  }

  const verseMatch = q.match(/\b(?:versiculo|verso|v)\s*(\d{1,3})\b/)
    ?? q.match(/^(?:e\s+)?(?:o\s+)?(\d{1,3})$/);
  if (verseMatch) {
    const verse = Number(verseMatch[1]);
    const verses = base.book.chapters[base.chapter - 1] ?? [];
    if (verse >= 1 && verse <= verses.length) return { book: base.book, bookName: base.bookName, chapter: base.chapter, verseStart: verse, verseEnd: verse };
  }
  return null;
}
'''
    s = s.replace(marker, '\n' + helper.rstrip() + marker, 1)

old = '''    bible = await loadBible(config);
    reference = parseBibleReference(input, bible);'''
new = '''    bible = await loadBible(config);
    const directReference = parseBibleReference(input, bible);
    reference = directReference ?? parseBibleFollowupReference(input, bible, history);
    if (!directReference && reference) route = "bible_lookup";'''
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)
