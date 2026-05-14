param(
    [string]$HostName = "localhost",
    [int]$Port = 5432,
    [string]$SuperUser = "postgres",
    [string]$SuperPassword = "contapro",
    [string]$AppUser = "contapro",
    [string]$AppPassword = "contapro",
    [string]$AppDatabase = "contapro",
    [switch]$SkipSeed
)

$ErrorActionPreference = "Stop"

function Resolve-PsqlPath {
    $fromPath = Get-Command psql -ErrorAction SilentlyContinue
    if ($fromPath) {
        return $fromPath.Source
    }

    $default = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
    if (Test-Path $default) {
        return $default
    }

    throw "No se encontro psql.exe. Instala PostgreSQL local primero."
}

function Resolve-PgBin {
    $psqlPath = Resolve-PsqlPath
    return Split-Path -Path $psqlPath -Parent
}

function Ensure-PostgresRunning {
    param(
        [string]$PgBin,
        [string]$AdminPassword
    )

    $pgReadyExe = Join-Path $PgBin 'pg_isready.exe'
    $initdbExe = Join-Path $PgBin 'initdb.exe'
    $pgCtlExe = Join-Path $PgBin 'pg_ctl.exe'
    $dataDir = Join-Path $env:USERPROFILE 'postgres17-data'
    $logFile = Join-Path $dataDir 'postgres.log'

    if ((Test-Path $pgReadyExe) -and ((& $pgReadyExe -h $HostName -p $Port) -match 'accepting connections')) {
        return
    }

    if ((Get-Service -Name postgresql* -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Running' })) {
        Get-Service -Name postgresql* -ErrorAction SilentlyContinue | Where-Object { $_.Status -ne 'Running' } | Start-Service -ErrorAction SilentlyContinue
        if ((& $pgReadyExe -h $HostName -p $Port) -match 'accepting connections') {
            return
        }
    }

    if (-not (Test-Path $initdbExe) -or -not (Test-Path $pgCtlExe)) {
        throw 'No se encontraron initdb/pg_ctl para inicializar PostgreSQL en modo usuario.'
    }

    if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
        New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
        $pwFile = Join-Path $env:TEMP 'pg_super_pw.txt'
        Set-Content -Path $pwFile -Value $AdminPassword -NoNewline
        try {
            & $initdbExe -D $dataDir -U $SuperUser -A scram-sha-256 --encoding=UTF8 --locale=C --pwfile=$pwFile | Out-String
        }
        finally {
            Remove-Item $pwFile -ErrorAction SilentlyContinue
        }
    }

    & $pgCtlExe -D $dataDir -l $logFile -o "-p $Port" start | Out-String

    if (-not ((& $pgReadyExe -h $HostName -p $Port) -match 'accepting connections')) {
        throw "PostgreSQL no responde en $HostName`:$Port luego de iniciar cluster local."
    }
}

function Invoke-Psql {
    param(
        [string]$PsqlExe,
        [string]$Db,
        [string]$Sql,
        [string]$User,
        [string]$Password
    )

    $env:PGPASSWORD = $Password
    try {
        & $PsqlExe -h $HostName -p $Port -U $User -d $Db -v ON_ERROR_STOP=1 -c $Sql | Out-String
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

$repoRoot = Split-Path -Path $PSScriptRoot -Parent
Set-Location $repoRoot

Write-Host "[1/5] Verificando psql..."
$psqlExe = Resolve-PsqlPath
Write-Host "psql: $psqlExe"

$pgBin = Resolve-PgBin

Write-Host "[2/5] Verificando conectividad PostgreSQL en $HostName`:$Port..."
Ensure-PostgresRunning -PgBin $pgBin -AdminPassword $SuperPassword

Write-Host "[3/5] Creando rol y base de datos de aplicacion..."
$env:PGPASSWORD = $SuperPassword
try {
    $roleExists = & $psqlExe -h $HostName -p $Port -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$AppUser';"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (($roleExists | Out-String).Trim() -ne "1") {
    $env:PGPASSWORD = $SuperPassword
    try {
        & $psqlExe -h $HostName -p $Port -U $SuperUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $AppUser LOGIN PASSWORD '$AppPassword';" | Out-String
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

$env:PGPASSWORD = $SuperPassword
try {
    $exists = & $psqlExe -h $HostName -p $Port -U $SuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$AppDatabase';"
}
finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

if (($exists | Out-String).Trim() -ne "1") {
    $env:PGPASSWORD = $SuperPassword
    try {
        & $psqlExe -h $HostName -p $Port -U $SuperUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $AppDatabase OWNER $AppUser;" | Out-String
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}

Write-Host "[4/5] Ejecutando migraciones Alembic..."
$env:DATABASE_URL = "postgresql+asyncpg://$AppUser`:$AppPassword@$HostName`:$Port/$AppDatabase"
try {
    & ".\.venv\Scripts\alembic.exe" upgrade head
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo alembic upgrade head"
    }
}
finally {
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

if (-not $SkipSeed) {
    Write-Host "[5/5] Aplicando seed enterprise..."
    $env:PGPASSWORD = $AppPassword
    try {
        & $psqlExe -h $HostName -p $Port -U $AppUser -d $AppDatabase -v ON_ERROR_STOP=1 -f ".\scripts\seed_enterprise.sql" | Out-String
        if ($LASTEXITCODE -ne 0) {
            throw "Fallo aplicando seed_enterprise.sql"
        }
    }
    finally {
        Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    }
}
else {
    Write-Host "[5/5] Seed omitido por parametro -SkipSeed"
}

Write-Host "OK: PostgreSQL local listo, migraciones aplicadas y entorno desbloqueado."