# Domain 1 (API) - "AFTER" evidence capture, following auth/CORS/headers/rate-limit remediation.
# Run from the birthday_memory project root while `npm run dev` is running in another window,
# after: npm --prefix server run seed:user has created a test account.
#
# Credentials are NOT hardcoded here on purpose (never commit a real working credential to a
# public repo, even a disposable local-dev one) - pass them as env vars or you'll be prompted:
#   $env:TEST_USERNAME = "team.lead"; $env:TEST_PASSWORD = "..."; .\domain1-api-after-tests.ps1
#
# Captures a full transcript to docs/assessment/testing/domain1-api-after-evidence.txt

param(
  [string]$Username = $env:TEST_USERNAME,
  [string]$Password = $env:TEST_PASSWORD
)
if (-not $Username) { $Username = Read-Host "Test account username" }
if (-not $Password) { $Password = Read-Host "Test account password" -AsSecureString | ConvertFrom-SecureString -AsPlainText }

$out = "docs\assessment\testing\domain1-api-after-evidence.txt"
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
"Domain 1 API - AFTER evidence - captured $(Get-Date -Format o)" | Out-File $out

# Cookie jar lives outside the repo and is deleted at the end - never commit a live session token.
$cookieJar = Join-Path $env:TEMP "birthday_memory_test_cookies.txt"
if (Test-Path $cookieJar) { Remove-Item $cookieJar -Force }

function Log($title) {
  Write-Host "`n===== $title =====" -ForegroundColor Cyan
  Add-Content $out "`n===== $title ====="
}

Log "1. Unauthenticated GET /api/birthdays (no credentials supplied) - expect 401, no PII returned"
curl.exe -i http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "2. CORS check - does the API reflect an arbitrary, untrusted origin? (expect no Access-Control-Allow-Origin for evil-example.test)"
curl.exe -i -H "Origin: http://evil-example.test" http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "3. Response headers check on /api/health - expect helmet security headers now present"
curl.exe -i http://localhost:4000/api/health 2>&1 | Tee-Object -FilePath $out -Append

Log "4. SQL injection probe #1 (tautology, ?q=) against the now-protected endpoint - expect 401 before query logic even runs"
curl.exe -i "http://localhost:4000/api/birthdays?q=%27%20OR%20%271%27%3D%271" 2>&1 | Tee-Object -FilePath $out -Append

Log "5. SQL injection probe #2 (stacked DROP TABLE attempt, ?q=) - expect 401, same reasoning"
curl.exe -i "http://localhost:4000/api/birthdays?q=x%27%3B%20DROP%20TABLE%20birthdays%3B%20--" 2>&1 | Tee-Object -FilePath $out -Append

Log "6. Unauthenticated POST /api/birthdays - expect 401, no probe record created"
$createBody = '{"firstName":"Probe","lastName":"Tamper","birthdate":"2001-02-02","email":"probe@example.com"}'
$tmpCreate = Join-Path $env:TEMP "bm_after_create.json"
Set-Content -Path $tmpCreate -Value $createBody -NoNewline
curl.exe -i -X POST http://localhost:4000/api/birthdays -H "Content-Type: application/json" -d "@$tmpCreate" 2>&1 | Tee-Object -FilePath $out -Append
Remove-Item $tmpCreate -Force

Log "7. Unauthenticated PUT /api/birthdays/<arbitrary-id> - expect 401 before any lookup/update happens"
$updateBody = '{"firstName":"Probe-EDITED-BY-STRANGER","lastName":"Tamper","birthdate":"2001-02-02","email":"probe@example.com"}'
$tmpUpdate = Join-Path $env:TEMP "bm_after_update.json"
Set-Content -Path $tmpUpdate -Value $updateBody -NoNewline
curl.exe -i -X PUT "http://localhost:4000/api/birthdays/00000000-0000-0000-0000-000000000000" -H "Content-Type: application/json" -d "@$tmpUpdate" 2>&1 | Tee-Object -FilePath $out -Append
Remove-Item $tmpUpdate -Force

Log "8. Unauthenticated DELETE /api/birthdays/<arbitrary-id> - expect 401"
curl.exe -i -X DELETE "http://localhost:4000/api/birthdays/00000000-0000-0000-0000-000000000000" 2>&1 | Tee-Object -FilePath $out -Append

Log "9. Login with valid seeded credentials - capture Set-Cookie (httpOnly session token, cookie itself not usable via JS)"
$loginBody = "{`"username`":`"$Username`",`"password`":`"$Password`"}"
$tmpLogin = Join-Path $env:TEMP "bm_after_login.json"
Set-Content -Path $tmpLogin -Value $loginBody -NoNewline
$loginRaw = curl.exe -i -c $cookieJar -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "@$tmpLogin" 2>&1
# Redact the live session JWT before it ever touches the transcript file - the cookie
# flags (HttpOnly/SameSite=Strict/Max-Age) are the evidence that matters, not the raw
# token value, and a signed credential has no business sitting in a committed file even
# if it's short-lived.
$loginRedacted = $loginRaw -replace '(Set-Cookie: birthday_memory_token=)[^;]+', '$1<redacted-session-jwt-not-committed>'
$loginRedacted | Tee-Object -FilePath $out -Append
Remove-Item $tmpLogin -Force

Log "10. Authenticated GET /api/birthdays using the session cookie from step 9 - expect 200 and all 8 seeded records"
curl.exe -s -i -b $cookieJar http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "11. Authenticated round trip - create, edit, delete a probe record while logged in (proves the fix did not break legitimate use)"
$createBody2 = '{"firstName":"Probe","lastName":"Authenticated","birthdate":"2001-02-02","email":"probe@example.com"}'
$tmpCreate2 = Join-Path $env:TEMP "bm_after_create2.json"
Set-Content -Path $tmpCreate2 -Value $createBody2 -NoNewline
$createRaw = curl.exe -s -i -b $cookieJar -X POST http://localhost:4000/api/birthdays -H "Content-Type: application/json" -d "@$tmpCreate2"
$createRaw | Tee-Object -FilePath $out -Append
Remove-Item $tmpCreate2 -Force
$createJson = ($createRaw -split "`r`n`r`n")[-1] | ConvertFrom-Json
$probeId = $createJson.id
Add-Content $out "`n[test script] Captured probe record id for cleanup: $probeId"
Write-Host "[test script] Captured probe record id: $probeId" -ForegroundColor Yellow

curl.exe -i -b $cookieJar -X DELETE "http://localhost:4000/api/birthdays/$probeId" 2>&1 | Tee-Object -FilePath $out -Append

Log "12. Final authenticated record count (should be back to 8 - the probe record was created and deleted by step 11)"
curl.exe -s -b $cookieJar http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "13. Login rate limiting - repeated wrong-password attempts against /api/auth/login, expect a 429 once the limit is hit"
$wrongBody = "{`"username`":`"$Username`",`"password`":`"definitely-wrong-password`"}"
$tmpWrong = Join-Path $env:TEMP "bm_after_wrong.json"
Set-Content -Path $tmpWrong -Value $wrongBody -NoNewline
for ($i = 1; $i -le 12; $i++) {
  Add-Content $out "`n--- attempt $i ---"
  curl.exe -s -o NUL -w "attempt $i -> HTTP %{http_code}`n" -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "@$tmpWrong" | Tee-Object -FilePath $out -Append
}
Remove-Item $tmpWrong -Force

Remove-Item $cookieJar -Force -ErrorAction SilentlyContinue

Write-Host "`nDone. Full transcript saved to $out" -ForegroundColor Green
Write-Host "Note: no credentials or session cookies were written to the repo - the cookie jar was a temp file, now deleted." -ForegroundColor Green
