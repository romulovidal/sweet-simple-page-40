from pathlib import Path

WORKFLOW = Path('.github/workflows/patch-birthday-ddmm.yml')
SCRIPT = Path('.github/scripts/patch_birthday_ddmm.py')


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected block not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


# Backend admin API: DD/MM input; day/month are the source of truth.
path = 'supabase/functions/atis-birthdays/index.ts'
replace_once(path, '''function validBirthDate(value: unknown) {
  const text = firstString(value);
  if (!text || !/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) throw new Error("INVALID_BIRTH_DATE");
  const parsed = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error("INVALID_BIRTH_DATE");
  }
  return text;
}
''', '''function parseBirthDayMonth(value: unknown, explicitDay?: unknown, explicitMonth?: unknown) {
  let day = Number(explicitDay);
  let month = Number(explicitMonth);

  if (!Number.isInteger(day) || !Number.isInteger(month)) {
    const text = firstString(value);
    if (!text) throw new Error("INVALID_BIRTH_DATE");

    const ddmm = text.match(/^(\\d{1,2})\\/(\\d{1,2})$/);
    const iso = text.match(/^\\d{4}-(\\d{2})-(\\d{2})$/);
    if (ddmm) {
      day = Number(ddmm[1]);
      month = Number(ddmm[2]);
    } else if (iso) {
      month = Number(iso[1]);
      day = Number(iso[2]);
    } else {
      throw new Error("INVALID_BIRTH_DATE");
    }
  }

  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1 || day > maxDay) {
    throw new Error("INVALID_BIRTH_DATE");
  }
  return { day, month };
}
''')

replace_once(path, '''    const payload = {
      source: "app",
      user_id: profile.user_id,
      name,
      birth_date: profile.birth_date,
      phone_e164: phone,
''', '''    const birthday = parseBirthDayMonth(profile.birth_date);
    const payload = {
      source: "app",
      user_id: profile.user_id,
      name,
      birth_day: birthday.day,
      birth_month: birthday.month,
      phone_e164: phone,
''')

replace_once(path,
    '.select("id,source,user_id,name,birth_date,phone_e164,tags,notes,is_active,created_at,updated_at")',
    '.select("id,source,user_id,name,birth_date,birth_day,birth_month,phone_e164,tags,notes,is_active,created_at,updated_at")')

replace_once(path, '''      const birthdays = (rows ?? [])
        .filter((row: any) => Number(String(row.birth_date).slice(5, 7)) === month)
        .sort((a: any, b: any) => Number(String(a.birth_date).slice(8, 10)) - Number(String(b.birth_date).slice(8, 10)) || a.name.localeCompare(b.name, "pt-BR"));''', '''      const birthdays = (rows ?? [])
        .filter((row: any) => Number(row.birth_month) === month)
        .sort((a: any, b: any) => Number(a.birth_day) - Number(b.birth_day) || a.name.localeCompare(b.name, "pt-BR"));''')

replace_once(path, '''      const birthDate = validBirthDate(data.birth_date);
      const phone = normalizePhone(data.phone ?? data.phone_e164);''', '''      const birthday = parseBirthDayMonth(data.birth_date ?? data.birth_day_month, data.birth_day, data.birth_month);
      const phone = normalizePhone(data.phone ?? data.phone_e164);''')

replace_once(path, '''        birth_date: birthDate,
        phone_e164: phone,''', '''        birth_day: birthday.day,
        birth_month: birthday.month,
        phone_e164: phone,''')

replace_once(path, '        if (data.birth_date !== undefined) patch.birth_date = validBirthDate(data.birth_date);', '''        if (data.birth_date !== undefined || data.birth_day_month !== undefined || data.birth_day !== undefined || data.birth_month !== undefined) {
          const birthday = parseBirthDayMonth(data.birth_date ?? data.birth_day_month, data.birth_day, data.birth_month);
          patch.birth_day = birthday.day;
          patch.birth_month = birthday.month;
        }''')

replace_once(path,
    '      } else if (data.name !== undefined || data.birth_date !== undefined || data.phone !== undefined || data.phone_e164 !== undefined) {',
    '      } else if (data.name !== undefined || data.birth_date !== undefined || data.birth_day_month !== undefined || data.birth_day !== undefined || data.birth_month !== undefined || data.phone !== undefined || data.phone_e164 !== undefined) {')

# Daily runner: use day/month columns directly.
path = 'supabase/functions/atis-birthday-runner/index.ts'
replace_once(path, '.select("id,name,birth_date")', '.select("id,name,birth_date,birth_day,birth_month")')
replace_once(path, '''    const today = (birthdays ?? []).filter((row: any) => {
      const value = String(row.birth_date ?? "");
      return Number(value.slice(5, 7)) === local.month && Number(value.slice(8, 10)) === local.day;
    }).sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));''', '''    const today = (birthdays ?? []).filter((row: any) => {
      const legacy = String(row.birth_date ?? "");
      const month = Number(row.birth_month ?? legacy.slice(5, 7));
      const day = Number(row.birth_day ?? legacy.slice(8, 10));
      return month === local.month && day === local.day;
    }).sort((a: any, b: any) => a.name.localeCompare(b.name, "pt-BR"));''')

# Admin UI: input, validation and display are DD/MM only.
path = 'src/components/admin/atis/AtisBirthdays.tsx'
replace_once(path, '''  birth_date: string;
  phone_e164?: string | null;''', '''  birth_date?: string | null;
  birth_day: number;
  birth_month: number;
  phone_e164?: string | null;''')

replace_once(path,
    '      APP_BIRTHDAY_SOURCE_MANAGED: "Este aniversário vem do cadastro do app e deve ser alterado no perfil do usuário.",',
    '      APP_BIRTHDAY_SOURCE_MANAGED: "Este aniversário vem do cadastro do app e deve ser alterado no perfil do usuário.",\n      INVALID_BIRTH_DATE: "Informe o aniversário no formato DD/MM.",')

replace_once(path, '''function formatPhone(value?: string | null) {
  if (!value) return "Sem WhatsApp — permitido";''', '''function formatBirthday(value: Pick<Birthday, "birth_day" | "birth_month">) {
  return `${String(value.birth_day).padStart(2, "0")}/${String(value.birth_month).padStart(2, "0")}`;
}

function maskBirthday(value: string) {
  const digits = value.replace(/\\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function isValidBirthday(value: string) {
  const match = value.match(/^(\\d{2})\\/(\\d{2})$/);
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const maxDay = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return Number.isInteger(day) && Number.isInteger(month) && month >= 1 && month <= 12 && day >= 1 && day <= maxDay;
}

function formatPhone(value?: string | null) {
  if (!value) return "Sem WhatsApp — permitido";''')

replace_once(path, 'setBirthDate(birthday.birth_date);', 'setBirthDate(formatBirthday(birthday));')
replace_once(path,
    '<p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Nome e data de nascimento são suficientes. O número de WhatsApp é opcional porque o envio inicial será feito somente no grupo configurado.</p>',
    '<p className="text-xs text-[hsl(var(--dark-muted))] mt-1">Nome e aniversário em DD/MM são suficientes. O ano de nascimento não é solicitado nem usado pelo ATIS. O WhatsApp é opcional.</p>')
replace_once(path,
    '<span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary font-bold shrink-0">{birthday.birth_date.slice(8, 10)}</span>',
    '<span className="w-11 h-11 rounded-xl grid place-items-center bg-primary/10 text-primary font-bold shrink-0">{String(birthday.birth_day).padStart(2, "0")}</span>')
replace_once(path,
    '<p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">{formatPhone(birthday.phone_e164)}</p>',
    '<p className="text-[11px] text-[hsl(var(--dark-muted))] mt-1">🎂 {formatBirthday(birthday)} • {formatPhone(birthday.phone_e164)}</p>')
replace_once(path,
    '<label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">Data de nascimento *</span><input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></label>',
    '<label className="block space-y-1.5"><span className="text-xs text-[hsl(var(--dark-muted))]">Aniversário (DD/MM) *</span><input type="text" inputMode="numeric" maxLength={5} value={birthDate} onChange={(event) => setBirthDate(maskBirthday(event.target.value))} placeholder="Ex.: 25/12" className="w-full h-11 rounded-xl bg-[hsl(var(--dark-bg))] border border-[hsl(var(--dark-card-hover))] px-3 text-sm text-[hsl(var(--dark-text))] outline-none" /></label>')
replace_once(path,
    'disabled={!name.trim() || !birthDate || busy !== null}',
    'disabled={!name.trim() || !isValidBirthday(birthDate) || busy !== null}')

# One-off tooling should not remain in main.
if WORKFLOW.exists():
    WORKFLOW.unlink()
if SCRIPT.exists():
    SCRIPT.unlink()
