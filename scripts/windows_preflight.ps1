# Read-only Windows preflight for the isolated MASLUL R5.2.16.4 candidate.
# Does not extract files, install packages, contact Google, or change system settings.
# Usage (PowerShell 5.1+):
#   .\windows_preflight.ps1 -ZipPath .\MASLUL_2027_R5_2_16_4_4_FINAL_TEST_CANDIDATE.zip -ExpectedSha256 <64-hex>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)] [string] $ZipPath,
    [Parameter(Mandatory = $true)] [ValidatePattern('^[A-Fa-f0-9]{64}$')] [string] $ExpectedSha256
)
$ErrorActionPreference = 'Stop'
$problems = New-Object System.Collections.Generic.List[string]
Write-Host 'MASLUL R5.2.16.4 — read-only Windows preflight'
Write-Host ('PowerShell: ' + $PSVersionTable.PSVersion.ToString())
if ($PSVersionTable.PSVersion -lt [version]'5.1') { $problems.Add('PowerShell 5.1 or later is required.') }

try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem
    Write-Host ('OS: ' + $os.Caption + ' | Version ' + $os.Version + ' | Build ' + $os.BuildNumber)
    if ($os.Caption -notmatch 'Windows 10') { $problems.Add('This runbook requires a Windows 10 machine; detected: ' + $os.Caption) }
} catch { $problems.Add('Could not identify Windows version: ' + $_.Exception.Message) }

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
    $problems.Add('node.exe not found on PATH.')
} else {
    $nodeOutput = & $node.Source -v 2>&1
    $nodeExitCode = $LASTEXITCODE
    $nodeVersion = ($nodeOutput | Out-String).Trim()
    Write-Host ('Node: ' + $nodeVersion)
    if ($nodeExitCode -ne 0) { $problems.Add('node.exe -v failed with exit code ' + $nodeExitCode + ': ' + $nodeVersion) }
    elseif ($nodeVersion -ne 'v22.23.4') { $problems.Add('Required Node is v22.23.4; detected ' + $nodeVersion) }
}

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) {
    $problems.Add('npm.cmd not found on PATH.')
} else {
    $npmOutput = & $npm.Source -v 2>&1
    $npmExitCode = $LASTEXITCODE
    $npmVersion = ($npmOutput | Out-String).Trim()
    Write-Host ('npm: ' + $npmVersion)
    if ($npmExitCode -ne 0) { $problems.Add('npm.cmd -v failed with exit code ' + $npmExitCode + ': ' + $npmVersion) }
    elseif ($npmVersion -notmatch '^10\.') { $problems.Add('Required npm is 10.x; detected ' + $npmVersion) }
}

try {
    $resolvedZip = (Resolve-Path -LiteralPath $ZipPath).Path
    $actualHash = (Get-FileHash -LiteralPath $resolvedZip -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Host ('ZIP: ' + $resolvedZip)
    Write-Host ('SHA-256: ' + $actualHash)
    if ($actualHash -ne $ExpectedSha256.ToLowerInvariant()) {
        Write-Host ('EXPECTED: ' + $ExpectedSha256.ToLowerInvariant())
        $problems.Add('ZIP SHA-256 mismatch. Do not extract or run this package.')
    }
} catch { $problems.Add('Could not hash the candidate ZIP: ' + $_.Exception.Message) }

if ($problems.Count -gt 0) {
    Write-Host 'PREFLIGHT: BLOCKED'
    foreach ($problem in $problems) { Write-Host (' - ' + $problem) }
    Write-Host 'No files were extracted and no project or Google data was changed.'
    exit 1
}
Write-Host 'PREFLIGHT: PASS — environment and archive hash only; this is NOT a test or release pass.'
Write-Host 'Next: extract to a new empty folder, generate a real npm lock with npm, then run the strict regression.'
exit 0
