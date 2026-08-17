from pathlib import Path

path = Path("supabase/functions/_shared/atis/assistant.ts")
text = path.read_text()

old_rule = '''  const devotionalRule = route === "devotional"
    ? "\\n- REFLEXÃO DEVOCIONAL DO ATIS: o único texto-base permitido é o versículo diário atual recuperado da Bíblia do Atalaia e fornecido em CONTEXTO BÍBLICO RECUPERADO DO APP. Exiba a referência e o texto completo recebido, sem alterá-lo, e construa a reflexão somente a partir dele. Não escolha outro versículo, não troque o tema e não omita o texto bíblico. Esta experiência deve refletir o botão Reflexão Devocional do app."
    : "";
'''
new_rule = '''  const devotionalRule = route === "devotional"
    ? "\\n- REFLEXÃO DEVOCIONAL DO ATIS: o único texto-base permitido é o versículo diário atual recuperado da Bíblia do Atalaia e fornecido em CONTEXTO BÍBLICO RECUPERADO DO APP. Exiba a referência e o texto completo recebido UMA ÚNICA VEZ no início, sem alterá-lo, e construa a reflexão somente a partir dele. Depois escreva exatamente 2 parágrafos de reflexão. Finalize com **Oração:** e uma oração ORIGINAL dirigida a Deus, de 2 a 4 frases curtas, baseada no ensinamento da passagem. A oração NÃO pode repetir a referência, NÃO pode copiar/transcrever o texto bíblico e NÃO pode usar o próprio versículo como oração. Termine a oração com Amém. Não escolha outro versículo, não troque o tema e não omita o texto bíblico. Esta experiência deve refletir o botão Reflexão Devocional do app."
    : "";
'''
if old_rule not in text:
    raise SystemExit("devotionalRule block not found")
text = text.replace(old_rule, new_rule, 1)

old_guard = '''  const guarded = guardUngroundedBibleQuotes(text, bibleContext?.text ?? null);
  if (route === "devotional" && bibleContext) {
    const placeholder = "📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*";
    const trustedDailyVerse = `📖 *${bibleContext.label}*\\n“${bibleContext.text}”`;
    return clampText(guarded.replaceAll(placeholder, trustedDailyVerse));
  }
  return clampText(guarded);
'''
new_guard = '''  const guarded = guardUngroundedBibleQuotes(text, bibleContext?.text ?? null);
  if (route === "devotional" && bibleContext) {
    const placeholder = "📖 *(texto bíblico: consulte a referência indicada; o ATIS só transcreve versículos recuperados do app)*";
    const trustedDailyVerse = `📖 *${bibleContext.label}*\\n“${bibleContext.text}”`;
    const prayerHeading = /(?:^|\\n)\\s*(?:\\*\\*)?Ora[cç][aã]o(?:\\*\\*)?\\s*:\\s*/i;

    // O texto bíblico confiável só pode ser restaurado antes da seção de oração.
    // Nunca transformamos um placeholder dentro da oração no próprio versículo.
    let devotional = guarded;
    const headingMatch = prayerHeading.exec(devotional);
    if (headingMatch?.index !== undefined) {
      const beforePrayer = devotional.slice(0, headingMatch.index).replaceAll(placeholder, trustedDailyVerse);
      const prayerAndAfter = devotional.slice(headingMatch.index);
      devotional = `${beforePrayer}${prayerAndAfter}`;
    } else {
      devotional = devotional.replace(placeholder, trustedDailyVerse);
    }

    const prayerMatch = /(?:^|\\n)\\s*(?:\\*\\*)?Ora[cç][aã]o(?:\\*\\*)?\\s*:\\s*([\\s\\S]*)$/i.exec(devotional);
    const prayerBody = firstString(prayerMatch?.[1]) ?? "";
    const normalizedPrayer = normalizedQuote(prayerBody);
    const normalizedBible = normalizedQuote(bibleContext.text);
    const normalizedReference = normalizedQuote(bibleContext.label);
    const fingerprint = normalizedBible.slice(0, Math.min(120, normalizedBible.length));
    const prayerRepeatsBible = Boolean(fingerprint.length >= 32 && normalizedPrayer.includes(fingerprint));
    const prayerRepeatsReference = Boolean(normalizedReference.length >= 4 && normalizedPrayer.includes(normalizedReference));
    const malformedPrayer = !prayerBody
      || prayerBody.length < 24
      || prayerBody.includes(placeholder)
      || prayerRepeatsBible
      || prayerRepeatsReference
      || prayerBody.includes("📖");

    if (malformedPrayer) {
      const repairResponse = await aiChatFetchWithProviders({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: "Escreva SOMENTE uma oração cristã curta em português brasileiro, dirigida diretamente a Deus. Use 2 a 4 frases naturais. Baseie a oração no ensinamento da passagem fornecida, mas NÃO cite a referência, NÃO copie nem transcreva nenhum trecho bíblico, NÃO use aspas e NÃO escreva comentários antes ou depois. Comece com Senhor ou Pai e termine com Amém. Você está corrigindo apenas a oração final de uma reflexão devocional.",
          },
          {
            role: "user",
            content: `Passagem-base: ${bibleContext.label}\\nTexto bíblico do app: ${bibleContext.text}\\n\\nEscreva somente a oração baseada no significado dessa passagem.`,
          },
        ],
        temperature: 0.45,
        max_tokens: 260,
      }, ["groq", "gemini"]);

      let repairedPrayer = "";
      if (repairResponse.ok) {
        const repairBody = await repairResponse.json().catch(() => null) as any;
        repairedPrayer = firstString(repairBody?.choices?.[0]?.message?.content) ?? "";
        repairedPrayer = repairedPrayer
          .replace(/^\\s*(?:\\*\\*)?Ora[cç][aã]o(?:\\*\\*)?\\s*:\\s*/i, "")
          .trim();
      }

      const repairedNormalized = normalizedQuote(repairedPrayer);
      const repairedStillRepeatsBible = Boolean(fingerprint.length >= 32 && repairedNormalized.includes(fingerprint));
      const repairedStillRepeatsReference = Boolean(normalizedReference.length >= 4 && repairedNormalized.includes(normalizedReference));
      if (!repairedPrayer || repairedStillRepeatsBible || repairedStillRepeatsReference || repairedPrayer.includes("📖")) {
        repairedPrayer = "Senhor, ajuda-nos a receber a Tua Palavra com humildade e a viver o que ela nos ensina. Dá-nos sabedoria, fé e um coração disposto a seguir a Tua vontade em cada escolha. Amém. 🙏";
      } else if (!/am[eé]m[.!]?\\s*(?:🙏)?\\s*$/i.test(repairedPrayer)) {
        repairedPrayer = `${repairedPrayer.replace(/\\s+$/g, "")} Amém. 🙏`;
      }

      const prayerReplacement = `\\n\\n**Oração:** ${repairedPrayer}`;
      if (prayerMatch?.index !== undefined) {
        devotional = `${devotional.slice(0, prayerMatch.index)}${prayerReplacement}`;
      } else {
        devotional = `${devotional.trimEnd()}${prayerReplacement}`;
      }
    }

    return clampText(devotional);
  }
  return clampText(guarded);
'''
if old_guard not in text:
    raise SystemExit("devotional guard block not found")
text = text.replace(old_guard, new_guard, 1)

path.write_text(text)
print("ATIS devotional prayer guard applied")
