from pathlib import Path

# Fix an existing malformed optional verse-range regex now that the provider is part of Deno validation.
p = Path('supabase/functions/_shared/atis/evolution-provider.ts')
s = p.read_text()
old = r'const match = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?)?$/u.exec(reference);'
new = r'const match = /^(.+?)\s+(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?$/u.exec(reference);'
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)

# Register the new ATIS screens in the application router.
p = Path('src/App.tsx')
s = p.read_text()
anchor = '''            <Route path="/atis/configuracoes" element={<AtisPage />} />
'''
extra = '''            <Route path="/atis/configuracoes" element={<AtisPage />} />
            <Route path="/atis/enviar" element={<AtisPage />} />
            <Route path="/atis/automacoes" element={<AtisPage />} />
            <Route path="/atis/historico" element={<AtisPage />} />
'''
if '<Route path="/atis/enviar"' not in s:
    assert anchor in s
    s = s.replace(anchor, extra, 1)
p.write_text(s)
