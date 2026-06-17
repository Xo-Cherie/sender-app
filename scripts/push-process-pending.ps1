# Flush pending notification_events via send-push-notification Edge Function.

param(
  [string]$DispatchSecret = $env:PUSH_DISPATCH_SECRET,
  [string]$ProjectRef = "kaxmrthocgmpfbsbvpge"
)

$ErrorActionPreference = "Stop"

if (-not $DispatchSecret) {
  if (Test-Path ".env") {
    $line = Get-Content ".env" | Where-Object { $_ -match '^PUSH_DISPATCH_SECRET=' } | Select-Object -First 1
    if ($line) {
      $DispatchSecret = ($line -replace '^PUSH_DISPATCH_SECRET=', '').Trim()
    }
  }
}

if (-not $DispatchSecret) {
  throw "Set PUSH_DISPATCH_SECRET env var or add it to .env as PUSH_DISPATCH_SECRET=..."
}

$uri = "https://$ProjectRef.supabase.co/functions/v1/send-push-notification"
$headers = @{
  "Content-Type" = "application/json"
  "X-Push-Dispatch-Secret" = $DispatchSecret
}

Write-Host "POST $uri" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri $uri -Method POST -Headers $headers -Body '{"processPending": true}'
$response | ConvertTo-Json -Depth 6
