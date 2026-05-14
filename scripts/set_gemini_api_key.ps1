param(
    [switch]$CheckApiStatus
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
Set-Location $repoRoot

$envFile = Join-Path $repoRoot '.env'
$envExample = Join-Path $repoRoot '.env.example'

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
    }
    else {
        New-Item -ItemType File -Path $envFile | Out-Null
    }
}

Write-Host 'Pega tu GEMINI API KEY y presiona Enter (no se mostrara en pantalla).'
$secureKey = Read-Host -AsSecureString 'GEMINI_API_KEY'

$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $plainKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}

if ([string]::IsNullOrWhiteSpace($plainKey)) {
    throw 'La clave GEMINI_API_KEY no puede estar vacia.'
}

$content = Get-Content -Path $envFile -Raw
if ($content -match '(?m)^GEMINI_API_KEY=') {
    $updated = [System.Text.RegularExpressions.Regex]::Replace($content, '(?m)^GEMINI_API_KEY=.*$', "GEMINI_API_KEY=$plainKey")
}
else {
    $separator = if ($content.EndsWith("`n") -or $content.Length -eq 0) { '' } else { "`r`n" }
    $updated = "$content$separator`r`nGEMINI_API_KEY=$plainKey`r`n"
}

Set-Content -Path $envFile -Value $updated -NoNewline
$env:GEMINI_API_KEY = $plainKey

Write-Host 'OK: GEMINI_API_KEY guardada en .env y cargada en la sesion actual.'
Write-Host 'Reinicia la API para que tome la nueva variable desde .env.'

if ($CheckApiStatus) {
    try {
        $status = Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8000/api/v1/ai/config/status'
        Write-Host ('Estado API AI: configured=' + $status.gemini_configured + ' model=' + $status.model)
    }
    catch {
        Write-Host 'No se pudo consultar /api/v1/ai/config/status (API no disponible o no iniciada).'
    }
}
