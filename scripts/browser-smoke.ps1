param(
    [string]$BashPath = '',
    [string]$BrowserEnv = '',
    [string]$TargetUrl = '',
    [string]$ArtifactDir = '',
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ScenarioArgs = @()
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

function Convert-ToGitBashLiteralPath {
    param([string]$WindowsPath)

    $fullPath = [System.IO.Path]::GetFullPath($WindowsPath)
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

function Resolve-BrowserEnvPath {
    param([string]$RequestedPath)

    $candidate = if ($RequestedPath) {
        $RequestedPath
    } else {
        Join-Path $RootDir '.conda\browser-test'
    }

    if (-not (Test-Path $candidate)) {
        throw "Browser test environment not found at $candidate. Run scripts/setup-browser-test.sh first."
    }

    $resolvedPath = (Resolve-Path $candidate).Path
    if (-not (Test-Path (Join-Path $resolvedPath 'python.exe')) -and -not (Test-Path (Join-Path $resolvedPath 'bin\python'))) {
        throw "Browser test environment not found at $resolvedPath. Run scripts/setup-browser-test.sh first."
    }

    return $resolvedPath
}

$resolvedBash = Resolve-GitBash -RequestedPath $BashPath
$resolvedBrowserEnv = Resolve-BrowserEnvPath -RequestedPath $BrowserEnv

$previousBrowserEnv = $env:HM_CLSS_BROWSER_ENV
$previousTargetUrl = $env:HM_CLSS_SMOKE_URL
$previousArtifactDir = $env:HM_CLSS_BROWSER_ARTIFACT_DIR

try {
    $env:HM_CLSS_BROWSER_ENV = Convert-ToGitBashPath $resolvedBrowserEnv
    if ($TargetUrl) {
        $env:HM_CLSS_SMOKE_URL = $TargetUrl
    }
    if ($ArtifactDir) {
        $env:HM_CLSS_BROWSER_ARTIFACT_DIR = Convert-ToGitBashLiteralPath $ArtifactDir
    }

    $rootForBash = Convert-ToGitBashPath $RootDir
    $quotedArgs = ($ScenarioArgs | ForEach-Object { Quote-Bash $_ }) -join ' '
    $command = "cd $(Quote-Bash $rootForBash) && bash scripts/browser-smoke.sh"
    if ($quotedArgs) {
        $command = "$command $quotedArgs"
    }

    & $resolvedBash -lc $command
    exit $LASTEXITCODE
} finally {
    $env:HM_CLSS_BROWSER_ENV = $previousBrowserEnv
    $env:HM_CLSS_SMOKE_URL = $previousTargetUrl
    $env:HM_CLSS_BROWSER_ARTIFACT_DIR = $previousArtifactDir
}
