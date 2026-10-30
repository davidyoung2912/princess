<#
.SYNOPSIS
  Full reset of the Princess test database: drop everything, create the schema, load the seeds.

.DESCRIPTION
  Runs, in order, with sqlcmd and -b (stops at the first error):
    1. db/00-drop-all.sql            drops every table the schema creates, and the ref and demo schemas
    2. db/01-schema.sql              creates the schemas and all tables
    3. db/seed/reference/run-all.sql reference data (ship, ports, sailings, venues, fares, legal text ...)
    4. db/seed/personas/*.sql        demo users and bookings (Phase 4; skipped while the folder does not exist)

  DESTRUCTIVE: all data in those tables is lost. Use on test databases only. The database itself must already exist.
  Windows authentication is used unless -User and -Password are given. Nothing is written to disk and no connection string is stored.

.EXAMPLE
  ./db/reset-db.ps1                                  # localhost, database princess, Windows auth, asks first
  ./db/reset-db.ps1 -Force                           # no question
  ./db/reset-db.ps1 -Server "(localdb)\MSSQLLocalDB" -Database princess_test -Force
  ./db/reset-db.ps1 -User sa -Password $env:SA_PASSWORD -Force
  ./db/reset-db.ps1 -SkipDrop                        # schema and seeds only (an empty database)
#>
[CmdletBinding()]
param(
  [string]$Server = 'localhost',
  [string]$Database = 'princess',
  [string]$User,
  [string]$Password,
  [switch]$SkipDrop,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot   # the :r paths inside run-all.sql are relative to the repository root

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
  throw 'sqlcmd was not found on PATH. Install the SQL Server command line tools (or go-sqlcmd) and try again.'
}

$steps = [System.Collections.Generic.List[string]]::new()
if (-not $SkipDrop) { $steps.Add('db/00-drop-all.sql') }
$steps.Add('db/01-schema.sql')
$steps.Add('db/seed/reference/run-all.sql')
$personas = Join-Path $PSScriptRoot 'seed/personas'
if (Test-Path $personas) {
  Get-ChildItem $personas -Filter '*.sql' | Sort-Object Name | ForEach-Object { $steps.Add("db/seed/personas/$($_.Name)") }
}

if (-not $Force) {
  $what = if ($SkipDrop) { 'LOAD the schema and seeds into' } else { 'DROP ALL DATA in, then rebuild' }
  $answer = Read-Host "This will $what database '$Database' on '$Server'. Type the database name to continue"
  if ($answer -ne $Database) { Write-Host 'Cancelled.'; exit 1 }
}

$auth = if ($User) { @('-U', $User, '-P', $Password) } else { @('-E') }

Push-Location $root
try {
  $clock = [System.Diagnostics.Stopwatch]::StartNew()
  foreach ($step in $steps) {
    Write-Host "==> $step" -ForegroundColor Cyan
    & sqlcmd -S $Server -d $Database @auth -C -b -i $step
    if ($LASTEXITCODE -ne 0) { throw "$step failed (sqlcmd exit code $LASTEXITCODE). Nothing after it was run." }
  }
  Write-Host ("Database '{0}' on '{1}' reset in {2:n1}s." -f $Database, $Server, $clock.Elapsed.TotalSeconds) -ForegroundColor Green
}
finally {
  Pop-Location
}
