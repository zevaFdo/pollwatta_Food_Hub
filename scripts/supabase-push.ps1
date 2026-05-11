# scripts/supabase-push.ps1
# -----------------------------------------------------------------------------
# Apply Supabase migrations to the linked cloud project.
#
# Why this exists: the project path contains '&', which breaks npm's auto-
# generated supabase.cmd shim (it relies on %~dp0 path expansion in cmd.exe
# and fails to resolve the path). This script bypasses the shim and calls the
# downloaded supabase.exe directly.
#
# Usage:
#   .\scripts\supabase-push.ps1                          # prompts for token & DB password
#   .\scripts\supabase-push.ps1 -MarkBaselineApplied     # one-time: tell the
#                                                        # CLI that 0001_init.sql
#                                                        # is already applied to
#                                                        # the cloud DB (used
#                                                        # when adopting a project
#                                                        # whose schema was created
#                                                        # via Studio/SQL editor
#                                                        # before linking the CLI).
#
#   $env:SUPABASE_ACCESS_TOKEN='sbp_...'; $env:SUPABASE_DB_PASSWORD='...'
#   .\scripts\supabase-push.ps1                          # uses env vars, no prompts
#
# How to get a Personal Access Token:
#   https://supabase.com/dashboard/account/tokens
#
# How to get the database password:
#   https://supabase.com/dashboard/project/wbejpdtlfhlixfsglirk/settings/database
# -----------------------------------------------------------------------------

[CmdletBinding()]
param(
    [string]$Token                = $env:SUPABASE_ACCESS_TOKEN,
    [string]$DbPassword           = $env:SUPABASE_DB_PASSWORD,
    [string]$ProjectRef           = 'wbejpdtlfhlixfsglirk',
    [string[]]$BaselineMigrations = @('0001'),
    [switch]$MarkBaselineApplied
)

$ErrorActionPreference = 'Stop'

function Read-SecretPrompt([string]$Prompt) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    return [System.Net.NetworkCredential]::new('', $secure).Password
}

if (-not $Token) {
    $Token = Read-SecretPrompt 'Supabase Personal Access Token (sbp_...)'
}
if (-not $DbPassword) {
    $DbPassword = Read-SecretPrompt 'Supabase Database password'
}

$env:SUPABASE_ACCESS_TOKEN = $Token

$ProjectRoot = (Resolve-Path -LiteralPath "$PSScriptRoot\..").Path
$Bin         = Join-Path $ProjectRoot 'node_modules\supabase\bin\supabase.exe'

if (-not (Test-Path -LiteralPath $Bin)) {
    Write-Error "Supabase CLI not found at $Bin. Run 'npm install' first."
    exit 1
}

Write-Host "Linking to project $ProjectRef..." -ForegroundColor Cyan
& $Bin link --project-ref $ProjectRef --password $DbPassword
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($MarkBaselineApplied) {
    foreach ($v in $BaselineMigrations) {
        Write-Host "Marking migration $v as already applied (baseline)..." -ForegroundColor Yellow
        & $Bin migration repair --status applied $v --password $DbPassword
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
}

Write-Host "Pushing migrations..." -ForegroundColor Cyan
& $Bin db push --password $DbPassword
exit $LASTEXITCODE
