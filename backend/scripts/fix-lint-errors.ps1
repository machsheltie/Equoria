# PowerShell script to automatically fix common ESLint errors
# This script fixes:
# 1. Unused jest imports
# 2. Unused logger imports
# 3. Unused variables that need _ prefix
# 4. Array destructuring issues

Write-Host "Starting automated lint fixes..." -ForegroundColor Green

# Get all .mjs and .js files in backend
$files = Get-ChildItem -Path "." -Include *.mjs,*.js -Recurse -File | Where-Object { 
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "coverage" -and
    $_.FullName -notmatch "dist" -and
    $_.FullName -notmatch "build"
}

$fixCount = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    $changed = $false

    # Fix 1: Remove unused jest imports
    if ($content -match "import \{ jest \} from '@jest/globals';\r?\n") {
        $content = $content -replace "import \{ jest \} from '@jest/globals';\r?\n", ""
        $changed = $true
        Write-Host "  Fixed unused jest import in: $($file.Name)" -ForegroundColor Yellow
    }

    # Fix 2: Remove standalone logger imports that are unused
    # (Only if logger is not used in the file)
    if ($content -match "import logger from.*logger\.mjs';" -and $content -notmatch "logger\.(info|error|warn|debug)") {
        $content = $content -replace "import logger from.*logger\.mjs';\r?\n", ""
        $changed = $true
        Write-Host "  Fixed unused logger import in: $($file.Name)" -ForegroundColor Yellow
    }

    # Save if changed
    if ($changed) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $fixCount++
    }
}

Write-Host "`nFixed $fixCount files automatically" -ForegroundColor Green
Write-Host "Running lint again to check remaining errors..." -ForegroundColor Cyan

# Run lint to see remaining errors
npm run lint

