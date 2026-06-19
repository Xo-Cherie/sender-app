# Stripe gift sandbox - backend smoke test (no user login required).
# Usage: powershell -ExecutionPolicy Bypass -File ./scripts/gifts-sandbox-test.ps1

$ErrorActionPreference = "Stop"
$projectUrl = "https://kaxmrthocgmpfbsbvpge.supabase.co"
$functionsBase = "$projectUrl/functions/v1"

Write-Host ""
Write-Host "=== Xo Cherie - Stripe Gift Sandbox Smoke Test ===" -ForegroundColor Cyan
Write-Host ""

function Test-FunctionReachable {
  param([string]$Name)
  try {
    $response = $null
    try {
      $response = Invoke-WebRequest -Uri "$functionsBase/$Name" -Method POST -ContentType "application/json" -Body "{}" -UseBasicParsing -ErrorAction Stop
    } catch {
      if ($_.Exception.Response) {
        $response = $_.Exception.Response
      } else {
        throw
      }
    }
    $statusCode = [int]$response.StatusCode
    if ($statusCode -eq 401) {
      Write-Host "OK  $Name is deployed (401 without auth, expected)" -ForegroundColor Green
      return $true
    }
    if ($statusCode -eq 503) {
      Write-Host "WARN $Name returned 503" -ForegroundColor Yellow
      return $false
    }
    Write-Host "OK  $Name responded $statusCode" -ForegroundColor Green
    return $true
  } catch {
    Write-Host "FAIL $Name unreachable: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

Write-Host "1. Edge Functions (deployed + reachable)" -ForegroundColor White
$functions = @(
  "create-gift-payment",
  "verify-gift-payment",
  "link-gift-to-card",
  "stripe-webhook",
  "create-connect-onboarding",
  "claim-gift-payout"
)
$ok = 0
foreach ($fn in $functions) {
  if (Test-FunctionReachable -Name $fn) { $ok++ }
}
Write-Host "   $ok / $($functions.Count) functions reachable"
Write-Host ""

Write-Host "2. Supabase secrets (names only - values hidden)" -ForegroundColor White
$secretList = supabase secrets list 2>&1 | Out-String
$required = @("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_APP_URL")
foreach ($name in $required) {
  if ($secretList -match $name) {
    Write-Host "OK  $name is set" -ForegroundColor Green
  } else {
    Write-Host "FAIL $name missing - run: supabase secrets set $name=..." -ForegroundColor Red
  }
}
Write-Host ""

Write-Host "3. Recent gift transactions (card_gifts)" -ForegroundColor White
if ($env:SUPABASE_DB_PASSWORD) {
  supabase db query --linked "select id, status, amount_cents, card_id, created_at from public.card_gifts order by created_at desc limit 5;"
} else {
  Write-Host "SKIP Set SUPABASE_DB_PASSWORD to query card_gifts" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "=== Manual sandbox test (browser) ===" -ForegroundColor Cyan
Write-Host "1. npm run start  ->  http://localhost:8081"
Write-Host "2. Sign in as sender"
Write-Host "3. Create Card -> ONE friend recipient only"
Write-Host "4. Gift step -> enter 5.00 USD"
Write-Host "5. Preview -> Send Card"
Write-Host "6. Stripe Checkout -> 4242 4242 4242 4242, future expiry, any CVC"
Write-Host "7. After redirect -> Gift Payment success -> Outbox"
Write-Host "8. Recipient -> Profile -> Set Up Gift Payouts"
Write-Host "9. Open card -> Claim Gift Payout"
Write-Host "10. Profile -> Gift Transaction History"
Write-Host ""
Write-Host "Stripe webhook URL:" -ForegroundColor White
Write-Host "  $functionsBase/stripe-webhook"
Write-Host ""
