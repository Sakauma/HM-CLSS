param(
    [string]$BashPath = '',
    [string]$PythonBin = '',
    [string]$NodeBin = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Resolve-GitBash {
    param([string]$RequestedPath)

    $candidates = @()
    if ($RequestedPath) { $candidates += $RequestedPath }
    foreach ($programFilesRoot in @(${env:ProgramFiles}, ${env:ProgramFiles(x86)})) {
        if (-not $programFilesRoot) { continue }
        $candidates += Join-Path $programFilesRoot 'Git\bin\bash.exe'
        $candidates += Join-Path $programFilesRoot 'Git\usr\bin\bash.exe'
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return (Resolve-Path $candidate).Path
        }
    }

    $pathCandidate = Get-Command bash.exe -ErrorAction SilentlyContinue
    if ($pathCandidate) {
        return $pathCandidate.Source
    }

    throw 'Git Bash was not found. Install Git for Windows or pass -BashPath.'
}

function Resolve-Executable {
    param(
        [string]$RequestedPath,
        [string]$EnvName,
        [string[]]$RepoCandidates,
        [string[]]$CommandCandidates
    )

    if ($RequestedPath -and (Test-Path $RequestedPath)) {
        return (Resolve-Path $RequestedPath).Path
    }

    $envValue = [Environment]::GetEnvironmentVariable($EnvName)
    if ($envValue -and (Test-Path $envValue)) {
        return (Resolve-Path $envValue).Path
    }

    foreach ($candidate in $RepoCandidates) {
        $fullPath = Join-Path $RootDir $candidate
        if (Test-Path $fullPath) {
            return (Resolve-Path $fullPath).Path
        }
    }

    foreach ($command in $CommandCandidates) {
        $resolved = Get-Command $command -ErrorAction SilentlyContinue
        if ($resolved) {
            return $resolved.Source
        }
    }

    throw "$EnvName could not be resolved. Install the tool or pass an explicit path."
}

function Convert-ToGitBashPath {
    param([string]$WindowsPath)

    $fullPath = (Resolve-Path $WindowsPath).Path
    if ($fullPath -match '^([A-Za-z]):\\(.*)$') {
        $drive = $Matches[1].ToLowerInvariant()
        $rest = $Matches[2] -replace '\\', '/'
        return "/$drive/$rest"
    }

    return ($fullPath -replace '\\', '/')
}

function Quote-Bash {
    param([string]$Value)
    return "'" + ($Value -replace "'", "'\''") + "'"
}

$resolvedBash = Resolve-GitBash -RequestedPath $BashPath
$resolvedPython = Resolve-Executable `
    -RequestedPath $PythonBin `
    -EnvName 'PYTHON_BIN' `
    -RepoCandidates @('.conda\browser-test\python.exe', '.conda\browser-test\bin\python') `
    -CommandCandidates @('python3.exe', 'python.exe', 'python3', 'python')
$resolvedNode = Resolve-Executable `
    -RequestedPath $NodeBin `
    -EnvName 'NODE_BIN' `
    -RepoCandidates @() `
    -CommandCandidates @('node.exe', 'node')

$previousPython = $env:PYTHON_BIN
$previousNode = $env:NODE_BIN
try {
    $env:PYTHON_BIN = Convert-ToGitBashPath $resolvedPython
    $env:NODE_BIN = Convert-ToGitBashPath $resolvedNode
    $rootForBash = Convert-ToGitBashPath $RootDir
    & $resolvedBash -lc "cd $(Quote-Bash $rootForBash) && bash scripts/smoke-check.sh"
    exit $LASTEXITCODE
} finally {
    $env:PYTHON_BIN = $previousPython
    $env:NODE_BIN = $previousNode
}
