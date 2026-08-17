from pathlib import Path

p = Path('supabase/functions/atis-console/index.ts')
s = p.read_text()
old = '  const groupByJid = new Map((groups.data ?? []).map((group: any) => [group.provider_group_id, group]));'
new = '  const groupByJid = new Map<string, any>((groups.data ?? []).map((group: any): [string, any] => [String(group.provider_group_id), group]));'
if old in s:
    s = s.replace(old, new, 1)
p.write_text(s)
