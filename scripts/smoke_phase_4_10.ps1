$ErrorActionPreference = 'Stop'

Write-Host 'Smoke phase 4-10: requesting dev token...'
$tokenResponse = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/auth/dev-token' -ContentType 'application/json' -Body (@{
  tenant_id = '11111111-1111-1111-1111-111111111111'
  user_id = 'erp.operator'
  role = 'ADMIN'
} | ConvertTo-Json)

$token = $tokenResponse.access_token
$headers = @{
  Authorization = "Bearer $token"
  'X-Tenant-Id' = '11111111-1111-1111-1111-111111111111'
}

Write-Host '1) Reports financial pack'
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/reports/financial-pack?year=2026&month=5&compare_year=2025&compare_month=5' -Headers $headers | ConvertTo-Json -Depth 5

Write-Host '2) Master data chart accounts'
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/master/chart-accounts?limit=20' -Headers $headers | ConvertTo-Json -Depth 4

Write-Host '3) Tax submissions monitor'
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/tax/submissions?limit=20' -Headers $headers | ConvertTo-Json -Depth 4

Write-Host '4) Period status (adjust month/year if needed)'
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/periods/status?year=2026&month=5' -Headers $headers | ConvertTo-Json -Depth 4

Write-Host 'Smoke finished.'
