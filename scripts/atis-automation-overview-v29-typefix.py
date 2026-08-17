from pathlib import Path

p = Path("supabase/functions/atis-console/index.ts")
text = p.read_text()
for old, new in [
    ("const contactById = new Map(", "const contactById = new Map<string, any>("),
    ("const individualById = new Map(", "const individualById = new Map<string, any>("),
    ("const groupById = new Map(", "const groupById = new Map<string, any>("),
    ("const destination = type ===", "const destination: any = type ==="),
]:
    if old not in text:
        raise SystemExit(f"typing anchor missing: {old}")
    text = text.replace(old, new, 1)
p.write_text(text)
