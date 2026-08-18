from pathlib import Path

PATH = Path("supabase/functions/create-verse-share/index.ts")
text = PATH.read_text()

old = '''    const { data: existing } = await supabase\n      .from("verse_shares")\n      .select("slug")\n      .eq("book_abbrev", book_abbrev)\n      .eq("chapter", chapter)\n      .eq("verses", sortedVerses)\n      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())\n      .maybeSingle();\n'''
new = '''    let existingQuery = supabase\n      .from("verse_shares")\n      .select("slug")\n      .eq("book_abbrev", book_abbrev)\n      .eq("chapter", chapter)\n      .contains("verses", sortedVerses)\n      .containedBy("verses", sortedVerses)\n      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());\n\n    existingQuery = version\n      ? existingQuery.eq("version", version)\n      : existingQuery.is("version", null);\n\n    const { data: existing, error: existingError } = await existingQuery\n      .order("created_at", { ascending: true })\n      .limit(1)\n      .maybeSingle();\n    if (existingError) throw existingError;\n'''

count = text.count(old)
if count != 1:
    raise SystemExit(f"verse share dedupe anchor mismatch: {count}")
PATH.write_text(text.replace(old, new, 1))
print("Native verse share dedupe fixed with contains + containedBy + version")
