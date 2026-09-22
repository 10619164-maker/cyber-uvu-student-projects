# Domain 1 (API) - "Before" evidence capture, unmodified codebase.
# Run from the birthday_memory project root while `npm run dev` is running in another window.
# Captures a full transcript to docs/assessment/testing/domain1-api-before-evidence.txt

$out = "docs\assessment\testing\domain1-api-before-evidence.txt"
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
"Domain 1 API - BEFORE evidence - captured $(Get-Date -Format o)" | Out-File $out

function Log($title) {
  Write-Host "`n===== $title =====" -ForegroundColor Cyan
  Add-Content $out "`n===== $title ====="
}

Log "1. Unauthenticated GET /api/birthdays (full record list, no credentials supplied)"
curl.exe -i http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "2. CORS check - does the API reflect an arbitrary, untrusted origin?"
curl.exe -i -H "Origin: http://evil-example.test" http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "3. Response headers check (looking for missing security headers - X-Content-Type-Options, CSP, etc.)"
curl.exe -i http://localhost:4000/api/health 2>&1 | Tee-Object -FilePath $out -Append

Log "4. SQL injection probe #1 - tautology in the search filter (?q=)"
curl.exe -i "http://localhost:4000/api/birthdays?q=%27%20OR%20%271%27%3D%271" 2>&1 | Tee-Object -FilePath $out -Append

Log "5. SQL injection probe #2 - attempted stacked DROP TABLE via the search filter"
curl.exe -i "http://localhost:4000/api/birthdays?q=x%27%3B%20DROP%20TABLE%20birthdays%3B%20--" 2>&1 | Tee-Object -FilePath $out -Append

Log "6. Confirm table integrity after injection probes (record count should be unchanged - baseline was 8)"
curl.exe -s http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Log "7. Unauthenticated POST /api/birthdays - create a probe record with no credentials"
$createBody = '{"firstName":"Probe","lastName":"Tamper","birthdate":"2001-02-02","email":"probe@example.com"}'
$createRaw = curl.exe -s -i -X POST http://localhost:4000/api/birthdays -H "Content-Type: application/json" -d $createBody
$createRaw | Tee-Object -FilePath $out -Append
$createJson = ($createRaw -split "`r`n`r`n")[-1] | ConvertFrom-Json
$probeId = $createJson.id
Add-Content $out "`n[test script] Captured probe record id for next steps: $probeId"
Write-Host "[test script] Captured probe record id: $probeId" -ForegroundColor Yellow

Log "8. Unauthenticated PUT /api/birthdays/<id> - tamper with someone else's record by ID alone, no ownership proof"
$updateBody = '{"firstName":"Probe-EDITED-BY-STRANGER","lastName":"Tamper","birthdate":"2001-02-02","email":"probe@example.com"}'
curl.exe -i -X PUT "http://localhost:4000/api/birthdays/$probeId" -H "Content-Type: application/json" -d $updateBody 2>&1 | Tee-Object -FilePath $out -Append

Log "9. Unauthenticated DELETE /api/birthdays/<id> - delete that same record with no credentials, then clean it up"
curl.exe -i -X DELETE "http://localhost:4000/api/birthdays/$probeId" 2>&1 | Tee-Object -FilePath $out -Append

Log "10. Final record count (should be back to 8 - the probe record was created and deleted by this script)"
curl.exe -s http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Write-Host "`nDone. Full transcript saved to $out" -ForegroundColor Green
