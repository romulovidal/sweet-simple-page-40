# ============================================================================
# verify-migration.ps1 — verificação pós-migração de karyuuhxeismshhxuokg
# Somente leitura. Nenhum segredo no arquivo.
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRef = "karyuuhxeismshhxuokg"
$ProjectUrl = "https://$ProjectRef.supabase.co"
$FnBase     = "$ProjectUrl/functions/v1"
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$OldRef     = "hvdmobypsqksgkfrzhzf"

if (-not $env:TARGET_SUPABASE_DB_URL) { throw "Defina `$env:TARGET_SUPABASE_DB_URL" }

$fail = 0
function Check($name, $actual, $expected) {
  if ("$actual" -eq "$expected") { Write-Host ("  OK   {0}: {1}" -f $name, $actual) -ForegroundColor Green }
  else { Write-Host ("  FALHA {0}: obtido '{1}', esperado '{2}'" -f $name, $actual, $expected) -ForegroundColor Red; $script:fail++ }
}
function Q($sql) { (psql $env:TARGET_SUPABASE_DB_URL -t -A -c $sql).Trim() }

Write-Host "`n=== 1. Conexão ===" -ForegroundColor Cyan
Check "conexão" (Q "select 1;") "1"
Write-Host "  banco: $(Q 'select current_database();')"

Write-Host "`n=== 2. Schema public ===" -ForegroundColor Cyan
Check "tabelas em public" (Q "select count(*) from pg_tables where schemaname='public';") "53"
Write-Host "  policies RLS: $(Q "select count(*) from pg_policies where schemaname='public';")"
Write-Host "  triggers:     $(Q "select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal;")"
Write-Host "  funções:      $(Q "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';")"
$noRls = Q "select count(*) from pg_tables t where t.schemaname='public' and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity);"
Check "tabelas sem RLS" $noRls "0"

Write-Host "`n=== 3. Auth (somente leitura) ===" -ForegroundColor Cyan
Write-Host "  auth.users:      $(Q 'select count(*) from auth.users;')"
Write-Host "  auth.identities: $(Q 'select count(*) from auth.identities;')"
Write-Host "  public.profiles: $(Q 'select count(*) from public.profiles;')"
Check "perfis duplicados" (Q "select count(*) from (select user_id from public.profiles group by user_id having count(*)>1) x;") "0"
Check "trigger on_auth_user_created" (Q "select count(*) from pg_trigger where tgname='on_auth_user_created' and not tgisinternal;") "1"

Write-Host "`n=== 4. Extensões ===" -ForegroundColor Cyan
Check "pg_cron" (Q "select count(*) from pg_extension where extname='pg_cron';") "1"
Check "pg_net"  (Q "select count(*) from pg_extension where extname='pg_net';")  "1"
Check "vault service_role_key" (Q "select count(*) from vault.secrets where name='service_role_key';") "1"

Write-Host "`n=== 5. Cron jobs ===" -ForegroundColor Cyan
Check "jobs ativos" (Q "select count(*) from cron.job where active;") "11"
Check "jobs com projeto antigo" (Q "select count(*) from cron.job where command like '%$OldRef%';") "0"
psql $env:TARGET_SUPABASE_DB_URL -c "select jobname, schedule, active from cron.job order by jobname;"

Write-Host "`n=== 6. Edge Functions ===" -ForegroundColor Cyan
$expected = @(
  "ai-tools","atis-birthday-greeting","atis-broadcast-runner","atis-daily-devotional",
  "atis-daily-verse-dm","atis-instance","atis-plans-runner","atis-send","atis-series-runner",
  "atis-webhook","atis-welcome-runner","classify-cantico","create-culto-share",
  "create-verse-share","cs","culto-reminder","daily-verse-push","delete-account","exegetai",
  "generate-push-message","og","og-culto","push-subscription","s","send-push",
  "smart-notifications","track-device","track-event","tts-verse","youtube-search"
)
$deployed = (supabase functions list --project-ref $ProjectRef) -join "`n"
$missing = @()
foreach ($f in $expected) { if ($deployed -notmatch "(?m)\b$([regex]::Escape($f))\b") { $missing += $f } }
Check "functions ausentes" $missing.Count 0
if ($missing.Count -gt 0) { Write-Host "  faltando: $($missing -join ', ')" -ForegroundColor Red }

Write-Host "`n=== 7. Endpoints públicos ===" -ForegroundColor Cyan
foreach ($ep in @("og","atis-webhook")) {
  try {
    $r = Invoke-WebRequest -Uri "$FnBase/$ep" -Method Options -TimeoutSec 20 -ErrorAction SilentlyContinue
    if ($r.StatusCode -eq 401) { Write-Host "  FALHA $ep respondeu 401 (verify_jwt ligado indevidamente)" -ForegroundColor Red; $fail++ }
    else { Write-Host "  OK   $ep -> HTTP $($r.StatusCode)" -ForegroundColor Green }
  } catch { Write-Host "  FALHA $ep inacessível: $_" -ForegroundColor Red; $fail++ }
}

Write-Host "`n=== 8. Referências ao projeto antigo no repositório ===" -ForegroundColor Cyan
$hits = Get-ChildItem -Path $RepoRoot -Recurse -File `
  -Exclude "*.log" `
  | Where-Object { $_.FullName -notmatch "\\(node_modules|dist|\.git|\.lovable)\\" } `
  | Select-String -Pattern $OldRef -SimpleMatch -ErrorAction SilentlyContinue
if ($hits) {
  Write-Host "  Ocorrências encontradas (avalie: .env e migrations antigas são esperadas):" -ForegroundColor Yellow
  $hits | ForEach-Object { Write-Host ("   - {0}:{1}" -f $_.Path, $_.LineNumber) }
} else { Write-Host "  OK   nenhuma referência" -ForegroundColor Green }

Write-Host "`n=== 9. Vercel ===" -ForegroundColor Cyan
$vercel = Get-Content (Join-Path $RepoRoot "vercel.json") -Raw
Check "rewrites apontando para o novo projeto" ([regex]::Matches($vercel, [regex]::Escape($ProjectRef)).Count) 2

Write-Host ""
if ($fail -gt 0) { Write-Host "$fail verificação(ões) falharam." -ForegroundColor Red; exit 1 }
Write-Host "Todas as verificações passaram." -ForegroundColor Green