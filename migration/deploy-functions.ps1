# ============================================================================
# deploy-functions.ps1 — deploy das 30 Edge Functions em karyuuhxeismshhxuokg
# Nenhum segredo neste arquivo.
# ============================================================================
$ErrorActionPreference = "Stop"

$ProjectRef = "karyuuhxeismshhxuokg"
$RepoRoot   = Split-Path -Parent $PSScriptRoot
$FnRoot     = Join-Path $RepoRoot "supabase\functions"
$ConfigPath = Join-Path $RepoRoot "supabase\config.toml"
$TargetCfg  = Join-Path $PSScriptRoot "config.target.toml"
$BackupCfg  = Join-Path $PSScriptRoot "config.toml.bak"

function Step($m) { Write-Host "`n>>> $m" -ForegroundColor Cyan }

Step "Verificando Supabase CLI"
supabase --version

Step "Login (abre o navegador se ainda não estiver autenticado)"
try { supabase projects list | Out-Null } catch { supabase login }

Step "Vinculando ao projeto $ProjectRef"
Push-Location $RepoRoot
supabase link --project-ref $ProjectRef; if ($LASTEXITCODE -ne 0) { throw "Erro ao vincular projeto" }
Pop-Location

Step "Trocando temporariamente supabase/config.toml pelo config.target.toml"
if (Test-Path $BackupCfg) {
  Write-Host "Restaurando backup anterior do config.toml..." -ForegroundColor Yellow
  Copy-Item $BackupCfg $ConfigPath -Force
}
Copy-Item $ConfigPath $BackupCfg -Force
Copy-Item $TargetCfg $ConfigPath -Force

$functions = @(
  "ai-tools","atis-birthday-greeting","atis-broadcast-runner","atis-daily-devotional",
  "atis-daily-verse-dm","atis-instance","atis-plans-runner","atis-send","atis-series-runner",
  "atis-webhook","atis-welcome-runner","classify-cantico","create-culto-share",
  "create-verse-share","cs","culto-reminder","daily-verse-push","delete-account","exegetai",
  "generate-push-message","og","og-culto","push-subscription","s","send-push",
  "smart-notifications","track-device","track-event","tts-verse","youtube-search"
)

$failed = @()
try {
  Step "Conferindo que todas as 30 pastas existem"
  foreach ($f in $functions) {
    if (-not (Test-Path (Join-Path $FnRoot "$f\index.ts"))) { throw "Entrypoint ausente: $f/index.ts" }
  }
  if (-not (Test-Path (Join-Path $FnRoot "_shared"))) { throw "Pasta _shared ausente" }
  Write-Host "30/30 entrypoints OK + _shared presente (o CLI empacota _shared automaticamente)" -ForegroundColor Green

  Push-Location $RepoRoot
  $i = 0
  foreach ($f in $functions) {
    $i++
    Step "[$i/$($functions.Count)] Deploy $f"
    try   { supabase functions deploy $f --project-ref $ProjectRef; if ($LASTEXITCODE -ne 0) { throw "Erro CLI $LASTEXITCODE" } }
    catch { Write-Host "FALHOU: $f" -ForegroundColor Red; $failed += $f }
  }
  Pop-Location
}
finally {
  Step "Restaurando supabase/config.toml original"
  Copy-Item $BackupCfg $ConfigPath -Force
  Remove-Item $BackupCfg -Force
}

if ($failed.Count -gt 0) {
  Write-Host "`nFunctions com falha: $($failed -join ', ')" -ForegroundColor Red
  exit 1
}
Write-Host "`nTodas as 30 functions deployadas em $ProjectRef" -ForegroundColor Green