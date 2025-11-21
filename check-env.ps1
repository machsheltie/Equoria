if (Test-Path Env:GITHUB_TOKEN) {
    Write-Output "GITHUB_TOKEN is SET"
} else {
    Write-Output "GITHUB_TOKEN is NOT set - please provide it"
}
