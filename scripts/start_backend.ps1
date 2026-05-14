param(
    [int]$Port = 8000
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
Set-Location $repoRoot

$uvicornPath = Join-Path $repoRoot '.venv\Scripts\uvicorn.exe'
$pythonPath = Join-Path $repoRoot '.venv\Scripts\python.exe'

if (Test-Path $uvicornPath) {
    Write-Host "Iniciando backend FastAPI en http://127.0.0.1:$Port"
    & $uvicornPath src.main:app --host 127.0.0.1 --port $Port --reload
    exit $LASTEXITCODE
}

if (Test-Path $pythonPath) {
    Write-Host "Iniciando backend FastAPI con python -m uvicorn en http://127.0.0.1:$Port"
    & $pythonPath -m uvicorn src.main:app --host 127.0.0.1 --port $Port --reload
    exit $LASTEXITCODE
}

Write-Error "No se encontró uvicorn en el entorno virtual. Crea el entorno y ejecuta 'pip install -r requirements.txt' o usa '.\.venv\Scripts\Activate.ps1'."
exit 1
