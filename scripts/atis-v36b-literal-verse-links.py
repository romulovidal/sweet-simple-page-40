from pathlib import Path

ASSISTANT = Path("supabase/functions/_shared/atis/assistant.ts")

text = ASSISTANT.read_text()
old = '''  const expansionTargets = contextReference?.verseStart ? [contextReference] : references.slice(0, 2);
  for (const reference of expansionTargets) {
    const canonical = bibleText(reference, false);
    const block = await trustedBibleBlock(supabase, config, reference);
    if (!block) continue;
    const linkMatch = block.match(/https:\\/\\/biblia\\.atalaias\\.online\\/v\\/[A-Za-z0-9_-]+/i);
    const linkLine = linkMatch ? `📖 Leia aqui: ${linkMatch[0]}` : null;
    const rawCanonicalPresent = output.includes(canonical.text);
    const normalizedCanonicalPresent = normalizedQuote(output).includes(normalizedQuote(canonical.text));
    if (rawCanonicalPresent || normalizedCanonicalPresent) {
      if (linkLine && !output.includes(linkMatch![0])) {
        output = rawCanonicalPresent
          ? output.replace(canonical.text, `${canonical.text}\\n\\n${linkLine}`)
          : `${output.trimEnd()}\\n\\n${linkLine}`;
      }
      continue;
    }
    output = `${output.trimEnd()}\\n\\n${block}`;
  }
'''
new = '''  let appendedBlocks = 0;
  for (const reference of references) {
    const canonical = bibleText(reference, false);
    const block = await trustedBibleBlock(supabase, config, reference);
    if (!block) continue;
    const linkMatch = block.match(/https:\\/\\/biblia\\.atalaias\\.online\\/v\\/[A-Za-z0-9_-]+/i);
    const linkLine = linkMatch ? `📖 Leia aqui: ${linkMatch[0]}` : null;
    const rawCanonicalPresent = output.includes(canonical.text);
    const normalizedCanonicalPresent = normalizedQuote(output).includes(normalizedQuote(canonical.text));

    // Every literal Bible passage already present in the answer receives its
    // verified app share link, even when several passages are shown.
    if (rawCanonicalPresent || normalizedCanonicalPresent) {
      if (linkLine && !output.includes(linkMatch![0])) {
        output = rawCanonicalPresent
          ? output.replace(canonical.text, `${canonical.text}\\n\\n${linkLine}`)
          : `${output.trimEnd()}\\n\\n${linkLine}`;
      }
      continue;
    }

    // Do not turn every merely-mentioned reference into a large Bible block.
    // With a primary passage, only that passage may be appended. Otherwise,
    // keep the existing cap of two automatically expanded references.
    const isPrimary = Boolean(
      contextReference?.verseStart
      && referenceKey(reference) === referenceKey(contextReference),
    );
    if (contextReference?.verseStart && !isPrimary) continue;
    if (!contextReference?.verseStart && appendedBlocks >= 2) continue;

    output = `${output.trimEnd()}\\n\\n${block}`;
    appendedBlocks++;
  }
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"expected exactly one enrich loop, got {count}")
text = text.replace(old, new, 1)
ASSISTANT.write_text(text)

# Static regression guards: all references are inspected for literal text,
# while non-literal auto-expansion remains capped.
patched = ASSISTANT.read_text()
assert "for (const reference of references)" in patched
assert "appendedBlocks >= 2" in patched
assert "references.slice(0, 2)" not in patched
