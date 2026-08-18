from pathlib import Path

PATH = Path("supabase/functions/_shared/atis/assistant.ts")
text = PATH.read_text()


def once(old: str, new: str, label: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 anchor, got {count}")
    text = text.replace(old, new, 1)

once('const VERSE_SHARE_ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";\n', '', 'remove local slug alphabet')

old_random = '''function randomVerseShareSlug(length = 6) {\n  const bytes = new Uint8Array(length);\n  crypto.getRandomValues(bytes);\n  let slug = "";\n  for (let index = 0; index < length; index++) slug += VERSE_SHARE_ALPHABET[bytes[index] % VERSE_SHARE_ALPHABET.length];\n  return slug;\n}\n\n'''
once(old_random, '', 'remove local slug generator')

old_helper = '''async function createShortVerseLink(supabase: any, config: any, reference: BibleReference, textSnippet: string) {\n  const verses = verseNumbers(reference);\n  if (!verses.length || verses.length > 50) return null;\n  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();\n  const { data: existing, error: existingError } = await supabase\n    .from("verse_shares")\n    .select("slug")\n    .eq("book_abbrev", reference.book.abbrev)\n    .eq("chapter", reference.chapter)\n    .eq("verses", verses)\n    .gte("created_at", cutoff)\n    .order("created_at", { ascending: false })\n    .limit(1)\n    .maybeSingle();\n  if (existingError) throw existingError;\n  if (firstString(existing?.slug)) return `${config.baseUrl}/v/${existing.slug}`;\n\n  for (let attempt = 0; attempt < 5; attempt++) {\n    const slug = randomVerseShareSlug();\n    const { error } = await supabase.from("verse_shares").insert({\n      slug,\n      book_abbrev: reference.book.abbrev,\n      chapter: reference.chapter,\n      verses,\n      text_snippet: textSnippet.slice(0, 600),\n      book_name: reference.bookName,\n      version: config.bibleVersion,\n    });\n    if (!error) return `${config.baseUrl}/v/${slug}`;\n    if (!String(error.message ?? "").toLowerCase().includes("duplicate key")) throw error;\n  }\n  return null;\n}\n'''
new_helper = '''async function createShortVerseLink(_supabase: any, config: any, reference: BibleReference, textSnippet: string) {\n  const verses = verseNumbers(reference);\n  if (!verses.length || verses.length > 50) return null;\n\n  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();\n  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();\n  if (!supabaseUrl || !serviceKey) throw new Error("VERSE_SHARE_SERVER_CONFIG_MISSING");\n\n  const response = await fetch(`${supabaseUrl}/functions/v1/create-verse-share`, {\n    method: "POST",\n    headers: {\n      "Content-Type": "application/json",\n      apikey: serviceKey,\n      Authorization: `Bearer ${serviceKey}`,\n    },\n    body: JSON.stringify({\n      book_abbrev: reference.book.abbrev,\n      chapter: reference.chapter,\n      verses,\n      text_snippet: textSnippet.slice(0, 600),\n      book_name: reference.bookName,\n      version: config.bibleVersion,\n    }),\n  });\n  const body = await response.json().catch(() => null) as any;\n  const slug = firstString(body?.slug);\n  if (!response.ok || !slug) {\n    throw new Error(firstString(body?.error) ?? `VERSE_SHARE_HTTP_${response.status}`);\n  }\n  return `${config.baseUrl}/v/${slug}`;\n}\n'''
once(old_helper, new_helper, 'official create-verse-share helper')

old_loop = '''  for (const reference of references.slice(0, 6)) {\n    const canonical = bibleText(reference, false);'''
new_loop = '''  const expansionTargets = contextReference?.verseStart ? [contextReference] : references.slice(0, 2);\n  for (const reference of expansionTargets) {\n    const canonical = bibleText(reference, false);'''
once(old_loop, new_loop, 'primary Bible expansion limit')

PATH.write_text(text)
print("ATIS v35c official verse-share integration patch applied")
