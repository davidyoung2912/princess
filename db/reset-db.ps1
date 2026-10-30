<#
.SYNOPSIS
  Full reset of the Princess test database: drop everything, create the schema, load the seeds.

.DESCRIPTION
  Runs, in order, with sqlcmd and -b (stops at the first error):
    1. db/00-drop-all.sql            drops every table the schema creates, and the ref and demo schemas
    2. db/01-schema.sql              creates the schemas and all tables
    3. db/seed/reference/*.sql       the nine reference seed files, in name order (not run-all.sql, which needs the repository root as working folder)
       reference data (ship, ports, sailings, venues, fares, legal text ...)
    4. db/seed/personas/*.sql        demo users and bookings (Phase 4; skipped while the folder does not exist)

  DESTRUCTIVE: all data in those tables is lost. Use on test databases only. The database itself must already exist.
  Windows authentication is used unless -User and -Password are given. Nothing is written to disk and no connection string is stored.

.EXAMPLE
  ./db/reset-db.ps1                                  # localhost, database princess, Windows auth
  ./db/reset-db.ps1 -Server "(localdb)\MSSQLLocalDB" -Database princess_test
  ./db/reset-db.ps1 -User sa -Password $env:SA_PASSWORD
  ./db/reset-db.ps1 -SkipDrop                        # schema and seeds only (an empty database)
#>
[CmdletBinding()]
param(
  [string]$Server = 'localhost',
  [string]$Database = 'princess',
  [string]$User,
  [string]$Password,
  [switch]$SkipDrop
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command sqlcmd -ErrorAction SilentlyContinue)) {
  throw 'sqlcmd was not found on PATH. Install the SQL Server command line tools (or go-sqlcmd) and try again.'
}

# Absolute paths throughout: this works from any folder, including a \\wsl.localhost share, where a child process cannot use the folder as its working directory.
$steps = [System.Collections.Generic.List[string]]::new()
if (-not $SkipDrop) { $steps.Add((Join-Path $PSScriptRoot '00-drop-all.sql')) }
$steps.Add((Join-Path $PSScriptRoot '01-schema.sql'))
foreach ($folder in 'seed/reference', 'seed/personas') {
  $dir = Join-Path $PSScriptRoot $folder
  if (Test-Path $dir) {
    Get-ChildItem $dir -Filter '*.sql' | Where-Object { $_.Name -ne 'run-all.sql' } | Sort-Object Name | ForEach-Object { $steps.Add($_.FullName) }
  }
}

[string[]]$sqlArgs = @('-S', $Server, '-d', $Database)
if ($User) { $sqlArgs += @('-U', $User, '-P', $Password) } else { $sqlArgs += '-E' }
$sqlArgs += @('-C', '-b')

$clock = [System.Diagnostics.Stopwatch]::StartNew()
foreach ($step in $steps) {
  Write-Host "==> $(Split-Path -Leaf $step)" -ForegroundColor Cyan
  & sqlcmd @sqlArgs -i $step
  if ($LASTEXITCODE -ne 0) { throw "$step failed (sqlcmd exit code $LASTEXITCODE). Nothing after it was run." }
}
Write-Host ("Database '{0}' on '{1}' reset in {2:n1}s." -f $Database, $Server, $clock.Elapsed.TotalSeconds) -ForegroundColor Green
