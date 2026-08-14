# ============================================================================
# migrate.ps1 — orquestrador único da migração para karyuuhxeismshhxuokg
# Não contém nenhum segredo. Lê tudo de variáveis de ambiente / arquivos locais.
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRef  = "karyuuhxeismshhxuokg"
$ProjectUrl  = "https://$ProjectRef.supabase.co"
$FnBase      = "$ProjectUrl/functions/v1"
$RepoRoot    = Split-Path -Parent $PSScriptRoot
$SecretsFile = Join-Path $PSScriptRoot ".env.secrets"

function Step($m) { Write-Host "`n===== $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "  OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  !!  $m" -ForegroundColor Yellow }

Write-Host "Migração -> $ProjectRef" -ForegroundColor White

# --- 0. Pré-requisitos ------------------------------------------------------
Step "0/5 Pré-requisitos"
supabase --version | Out-Null; Ok "Supabase CLI"
psql --version     | Out-Null; Ok "psql"
if (-not $env:TARGET_SUPABASE_DB_URL) {
  throw "Defina a connection string do NOVO projeto antes de rodar: `$env:TARGET_SUPABASE_DB_URL = '<postgresql://...>'"
}
Ok "TARGET_SUPABASE_DB_URL presente"
if (-not (Test-Path $SecretsFile)) {
  throw "Crie $SecretsFile a partir de secrets.example.env e preencha os valores."
}
Ok "$SecretsFile encontrado"

# --- 1. Secrets -------------------------------------------------------------
Step "1/5 Publicando secrets das Edge Functions (valores nunca são exibidos)"
Push-Location $RepoRoot
supabase secrets set --env-file $SecretsFile --project-ref $ProjectRef
Pop-Location
Ok "Secrets aplicados"

# --- 2. Deploy das Edge Functions ------------------------------------------
Step "2/5 Deploy das 30 Edge Functions"
& (Join-Path $PSScriptRoot "deploy-functions.ps1")
Ok "Edge Functions deployadas"

# --- 3. Vault: service_role key para os cron jobs ---------------------------
Step "3/5 Vault (service_role_key usada pelos cron jobs)"
$hasSecret = (psql $env:TARGET_SUPABASE_DB_URL -t -A -c "select count(*) from vault.secrets where name = 'service_role_key';").Trim()
if ($hasSecret -eq "0") {
  Warn "Segredo ausente no Vault. Informe a service_role key do novo projeto (entrada oculta)."
  $sec  = Read-Host -AsSecureString "service_role key"
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec)
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  $tmp = New-TemporaryFile
  "select vault.create_secret(:'k', 'service_role_key');" | Set-Content $tmp -Encoding utf8
  psql $env:TARGET_SUPABASE_DB_URL -v ON_ERROR_STOP=1 -v k="$plain" -f $tmp | Out-Null
  Remove-Item $tmp -Force
  $plain = $null
  Ok "Segredo gravado no Vault"
} else {
  Ok "Segredo já existe no Vault"
}

# --- 4. SQL de infraestrutura (extensões, trigger, cron jobs) ---------------
Step "4/5 Executando migrate.sql (extensões + trigger + 11 cron jobs)"
psql $env:TARGET_SUPABASE_DB_URL -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot "migrate.sql")
Ok "Infraestrutura SQL aplicada"

# --- 5. Verificação ---------------------------------------------------------
Step "5/5 Verificação"
& (Join-Path $PSScriptRoot "verify-migration.ps1")

Write-Host "`nConcluído. Pendências manuais: ver MIGRATION_README.md (seção 'Passos manuais')." -ForegroundColor White
Write-Host "Base das functions: $FnBase" -ForegroundColor DarkGray