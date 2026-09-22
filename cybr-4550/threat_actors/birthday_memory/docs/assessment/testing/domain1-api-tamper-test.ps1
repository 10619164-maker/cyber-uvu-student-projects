# Domain 1 (API) - unauthenticated tamper test (create/update/delete by ID, no credentials).
# Uses temp JSON files for curl payloads to avoid PowerShell-to-native-exe quote mangling.
# Appends to the same evidence transcript as the main before-tests script.

$out = "docs\assessment\testing\domain1-api-before-evidence.txt"
$tmpDir = "docs\assessment\testing\.tmp"
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

function Log($title) {
  Write-Host "`n===== $title =====" -ForegroundColor Cyan
  Add-Content $out "`n===== $title ====="
}

Log "7b. Unauthenticated POST /api/birthdays - create a probe record with no credentials (file-based payload)"
$createFile = "$tmpDir\create-payload.json"
'{"firstName":"Probe","lastName":"Tamper","birthdate":"2001-02-02","email":"probe@example.com"}' | Set-Content -Path $createFile -NoNewline -Encoding utf8
$createRaw = curl.exe -s -i -X POST http://localhost:4000/api/birthdays -H "Content-Type: application/json" -d "@$createFile"
$createRaw | Tee-Object -FilePath $out -Append
$bodyStart = ($createRaw | Select-String -Pattern '^\{' | Select-Object -First 1).LineNumber
$createJson = $createRaw[($bodyStart - 1)..($createRaw.Count - 1)] -join "" | ConvertFrom-Json
$probeId = $createJson.id
Add-Content $out "`n[test script] Captured probe record id: $probeId"
Write-Host "[test script] Captured probe record id: $probeId" -ForegroundColor Yellow

Log "8b. Unauthenticated PUT /api/birthdays/<id> - tamper with the record by ID alone, no ownership proof"
$updateFile = "$tmpDir\update-payload.json"
'{"firstName":"Probe-EDITED-BY-STRANGER","lastName":"Tamper","birthdate":"2001-02-02","email":"probe@example.com"}' | Set-Content -Path $updateFile -NoNewline -Encoding utf8
curl.exe -i -X PUT "http://localhost:4000/api/birthdays/$probeId" -H "Content-Type: application/json" -d "@$updateFile" 2>&1 | Tee-Object -FilePath $out -Append

Log "9b. Unauthenticated DELETE /api/birthdays/<id> - delete that same record with no credentials, then clean it up"
curl.exe -i -X DELETE "http://localhost:4000/api/birthdays/$probeId" 2>&1 | Tee-Object -FilePath $out -Append

Log "10b. Final record count (should be back to 8)"
curl.exe -s http://localhost:4000/api/birthdays 2>&1 | Tee-Object -FilePath $out -Append

Remove-Item -Path $tmpDir -Recurse -Force
Write-Host "`nDone. Appended to $out" -ForegroundColor Green
