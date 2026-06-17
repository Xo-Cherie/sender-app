# Push notification setup and test commands
# Run from project root in PowerShell.

param(
  [string]$DispatchSecret = $env:PUSH_DISPATCH_SECRET,
  [string]$AnonKey = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY,
  [string]$ProjectRef = "kaxmrthocgmpfbsbvpge"
)

$ErrorActionPreference = "Stop"

if (-not $DispatchSecret) {
  Write-Host "Set PUSH_DISPATCH_SECRET or pass -DispatchSecret" -ForegroundColor Yellow
  $DispatchSecret = Read-Host "Enter PUSH_DISPATCH_SECRET"
}

if (-not $AnonKey) {
  if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' } | Select-Object -First 1
    if ($line) {
      $AnonKey = ($line -replace '^EXPO_PUBLIC_SUPABASE_ANON_KEY=', '').Trim()
    }
  }
}

if (-not $AnonKey) {
  throw "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY"
}

$dispatchUrl = "https://$ProjectRef.supabase.co/functions/v1/send-push-notification"

Write-Host "1. Setting Edge Function secret..." -ForegroundColor Cyan
supabase secrets set "PUSH_DISPATCH_SECRET=$DispatchSecret"

Write-Host "2. Deploying push Edge Functions..." -ForegroundColor Cyan
supabase functions deploy register-push-token
supabase functions deploy send-push-notification

Write-Host "3. Applying database migrations..." -ForegroundColor Cyan
if ($env:SUPABASE_DB_PASSWORD) {
  supabase db push --yes
} else {
  Write-Host "   Set SUPABASE_DB_PASSWORD then run: supabase db push --yes" -ForegroundColor Yellow
}

Write-Host "4. Update dispatch config in Supabase SQL Editor:" -ForegroundColor Cyan
Write-Host @"

insert into public.notification_dispatch_config (id, dispatch_url, dispatch_secret, dispatch_anon_key)
values (
  1,
  '$dispatchUrl',
  '$DispatchSecret',
  '$AnonKey'
)
on conflict (id) do update set
  dispatch_url = excluded.dispatch_url,
  dispatch_secret = excluded.dispatch_secret,
  dispatch_anon_key = excluded.dispatch_anon_key,
  updated_at = timezone('utc', now());

"@

Write-Host "5. After SQL, flush pending events:" -ForegroundColor Cyan
Write-Host "   npm run push:process-pending" -ForegroundColor White

Write-Host "6. EAS credentials (interactive):" -ForegroundColor Cyan
Write-Host "   npx eas-cli credentials" -ForegroundColor White
Write-Host "   npx eas-cli build --platform android --profile preview" -ForegroundColor White
