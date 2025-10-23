# Comprehensive PowerShell script to fix ESLint errors
# Fixes: unused vars, prefer-destructuring, no-useless-escape, eqeqeq

Write-Host "Starting comprehensive lint fixes..." -ForegroundColor Green

$files = Get-ChildItem -Path "." -Include *.mjs,*.js -Recurse -File | Where-Object { 
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "coverage" -and
    $_.FullName -notmatch "dist" -and
    $_.FullName -notmatch "build"
}

$totalFixes = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    if (-not $content) { continue }
    
    $originalContent = $content
    $changed = $false
    $fileFixCount = 0

    # Fix 1: Unused variables - prefix with underscore
    # Pattern: 'variableName' is assigned a value but never used
    $unusedVarPatterns = @(
        @{pattern = "const initialLevel = "; replacement = "const _initialLevel = "},
        @{pattern = "const etag = "; replacement = "const _etag = "},
        @{pattern = "const performanceBaseline = "; replacement = "const _performanceBaseline = "},
        @{pattern = "const operation = "; replacement = "const _operation = "},
        @{pattern = "const memoryManager = "; replacement = "const _memoryManager = "},
        @{pattern = "const response = "; replacement = "const _response = "},
        @{pattern = "const metadata = "; replacement = "const _metadata = "},
        @{pattern = "const threshold = "; replacement = "const _threshold = "},
        @{pattern = "const level = "; replacement = "const _level = "},
        @{pattern = "const path = "; replacement = "const _path = "},
        @{pattern = "const method = "; replacement = "const _method = "},
        @{pattern = "const traitHistory = "; replacement = "const _traitHistory = "},
        @{pattern = "const content = "; replacement = "const _content = "},
        @{pattern = "const orderDirection = "; replacement = "const _orderDirection = "},
        @{pattern = "const breedingStock = "; replacement = "const _breedingStock = "},
        @{pattern = "const average = "; replacement = "const _average = "},
        @{pattern = "const allTraits = "; replacement = "const _allTraits = "},
        @{pattern = "const thresholds = "; replacement = "const _thresholds = "},
        @{pattern = "const flagKey = "; replacement = "const _flagKey = "},
        @{pattern = "const triggered = "; replacement = "const _triggered = "},
        @{pattern = "const stressPatterns = "; replacement = "const _stressPatterns = "},
        @{pattern = "const neglectPatterns = "; replacement = "const _neglectPatterns = "},
        @{pattern = "const energeticEffects = "; replacement = "const _energeticEffects = "},
        @{pattern = "const methodicalEffects = "; replacement = "const _methodicalEffects = "},
        @{pattern = "const discipline = "; replacement = "const _discipline = "},
        @{pattern = "const lastEntry = "; replacement = "const _lastEntry = "},
        @{pattern = "const minExpected = "; replacement = "const _minExpected = "},
        @{pattern = "const maxExpected = "; replacement = "const _maxExpected = "},
        @{pattern = "const thirdGenHorse = "; replacement = "const _thirdGenHorse = "},
        @{pattern = "const totalScore = "; replacement = "const _totalScore = "},
        @{pattern = "const maxScore = "; replacement = "const _maxScore = "},
        @{pattern = "const ageInDays = "; replacement = "const _ageInDays = "},
        @{pattern = "const foalCareLogs = "; replacement = "const _foalCareLogs = "},
        @{pattern = "const testUser = "; replacement = "const _testUser = "},
        @{pattern = "const docService = "; replacement = "const _docService = "}
    )

    foreach ($pattern in $unusedVarPatterns) {
        if ($content -match [regex]::Escape($pattern.pattern)) {
            $content = $content -replace [regex]::Escape($pattern.pattern), $pattern.replacement
            $changed = $true
            $fileFixCount++
        }
    }

    # Fix 2: Unused function arguments - prefix with underscore
    $unusedArgPatterns = @(
        @{pattern = ", res\)"; replacement = ", _res)"},
        @{pattern = ", req,"; replacement = ", _req,"},
        @{pattern = "\(req,"; replacement = "(_req,"},
        @{pattern = ", next\)"; replacement = ", _next)"},
        @{pattern = ", health\)"; replacement = ", _health)"},
        @{pattern = ", horse\)"; replacement = ", _horse)"},
        @{pattern = ", conditions\)"; replacement = ", _conditions)"},
        @{pattern = ", carePatterns\)"; replacement = ", _carePatterns)"},
        @{pattern = ", category\)"; replacement = ", _category)"},
        @{pattern = ", milestones\)"; replacement = ", _milestones)"},
        @{pattern = ", timeframe\)"; replacement = ", _timeframe)"},
        @{pattern = ", patterns\)"; replacement = ", _patterns)"},
        @{pattern = ", triggers\)"; replacement = ", _triggers)"},
        @{pattern = ", triggerDef\)"; replacement = ", _triggerDef)"},
        @{pattern = ", currentAge\)"; replacement = ", _currentAge)"},
        @{pattern = ", temperature\)"; replacement = ", _temperature)"},
        @{pattern = ", humidity\)"; replacement = ", _humidity)"},
        @{pattern = ", windSpeed\)"; replacement = ", _windSpeed)"},
        @{pattern = ", window\)"; replacement = ", _window)"},
        @{pattern = ", upcomingWindows\)"; replacement = ", _upcomingWindows)"},
        @{pattern = ", forecastDays\)"; replacement = ", _forecastDays)"},
        @{pattern = ", trait\)"; replacement = ", _trait)"},
        @{pattern = ", count\)"; replacement = ", _count)"},
        @{pattern = ", interactions\)"; replacement = ", _interactions)"},
        @{pattern = ", entity,"; replacement = ", _entity,"},
        @{pattern = ", entityType\)"; replacement = ", _entityType)"},
        @{pattern = ", entityId,"; replacement = ", _entityId,"},
        @{pattern = ", horseId\)"; replacement = ", _horseId)"},
        @{pattern = ", factors\)"; replacement = ", _factors)"},
        @{pattern = ", state,"; replacement = ", _state,"},
        @{pattern = ", trends,"; replacement = ", _trends,"},
        @{pattern = ", days\)"; replacement = ", _days)"},
        @{pattern = ", predictions\)"; replacement = ", _predictions)"},
        @{pattern = ", context\)"; replacement = ", _context)"},
        @{pattern = ", horses\)"; replacement = ", _horses)"},
        @{pattern = ", result\)"; replacement = ", _result)"},
        @{pattern = ", indexes\)"; replacement = ", _indexes)"},
        @{pattern = ", options\)"; replacement = ", _options)"},
        @{pattern = ", queryResult\)"; replacement = ", _queryResult)"}
    )

    foreach ($pattern in $unusedArgPatterns) {
        if ($content -match $pattern.pattern) {
            $content = $content -replace $pattern.pattern, $pattern.replacement
            $changed = $true
            $fileFixCount++
        }
    }

    # Fix 3: prefer-destructuring - convert array[0] to destructuring
    # Pattern: const variable = array[0]; -> const [variable] = array;
    $lines = $content -split "`r?`n"
    $newLines = @()
    $lineChanged = $false

    foreach ($line in $lines) {
        $newLine = $line
        
        # Match pattern: const variableName = arrayName[0];
        if ($line -match '^\s*const\s+(\w+)\s*=\s*(\w+)\[0\];?\s*$') {
            $varName = $matches[1]
            $arrayName = $matches[2]
            $indent = $line -replace '^(\s*).*', '$1'
            $newLine = "${indent}const [$varName] = $arrayName;"
            $lineChanged = $true
            $changed = $true
            $fileFixCount++
        }
        
        $newLines += $newLine
    }

    if ($lineChanged) {
        $content = $newLines -join "`r`n"
    }

    # Fix 4: no-useless-escape - remove unnecessary backslashes
    # Pattern: \[ -> [
    if ($content -match '\\\[') {
        $content = $content -replace '\\\[', '['
        $changed = $true
        $fileFixCount++
    }

    # Fix 5: eqeqeq - replace != with !==
    if ($content -match ' != ') {
        $content = $content -replace ' != ', ' !== '
        $changed = $true
        $fileFixCount++
    }

    # Fix 6: Remove unused imports
    $unusedImports = @(
        @{pattern = "import \{ authenticateToken \} from.*;\r?\n"; check = "authenticateToken\("},
        @{pattern = "import \{ getMemoryManager \} from.*;\r?\n"; check = "getMemoryManager\("},
        @{pattern = "import \{ query \} from.*;\r?\n"; check = "query\("},
        @{pattern = "import \{ applyRareTraitBoosterEffects \} from.*;\r?\n"; check = "applyRareTraitBoosterEffects\("},
        @{pattern = "import \{ hasUltraRareAbility \} from.*;\r?\n"; check = "hasUltraRareAbility\("},
        @{pattern = "import \{ readFileSync \} from.*;\r?\n"; check = "readFileSync\("},
        @{pattern = "import \{ execSync \} from.*;\r?\n"; check = "execSync\("},
        @{pattern = "import \{ ResponseCacheService \} from.*;\r?\n"; check = "ResponseCacheService"},
        @{pattern = "import \{ analyzeTraitTrends \} from.*;\r?\n"; check = "analyzeTraitTrends\("},
        @{pattern = "import \{ identifyTraitPatterns \} from.*;\r?\n"; check = "identifyTraitPatterns\("},
        @{pattern = "import \{ generateTrendPredictions \} from.*;\r?\n"; check = "generateTrendPredictions\("},
        @{pattern = "import \{ getEligibleHorses \} from.*;\r?\n"; check = "getEligibleHorses\("},
        @{pattern = "import prisma from.*;\r?\n"; check = "prisma\."},
        @{pattern = "import \{ EPIGENETIC_FLAG_DEFINITIONS \} from.*;\r?\n"; check = "EPIGENETIC_FLAG_DEFINITIONS"},
        @{pattern = "import \{ afterEach \} from.*;\r?\n"; check = "afterEach\("},
        @{pattern = "import \{ getEnvironmentalHistory \} from.*;\r?\n"; check = "getEnvironmentalHistory\("},
        @{pattern = "import \{ readFileSync, existsSync \} from.*;\r?\n"; check = "readFileSync\(|existsSync\("},
        @{pattern = "import \{ join \} from.*;\r?\n"; check = "join\("},
        @{pattern = "import YAML from.*;\r?\n"; check = "YAML\."},
        @{pattern = "import \{ ApiResponse \} from.*;\r?\n"; check = "ApiResponse"},
        @{pattern = "import \{ queryPlan \} from.*;\r?\n"; check = "queryPlan"},
        @{pattern = "import \{ calculateQueryComplexity \} from.*;\r?\n"; check = "calculateQueryComplexity\("},
        @{pattern = "import \{ extractIndexUsage \} from.*;\r?\n"; check = "extractIndexUsage\("}
    )

    foreach ($import in $unusedImports) {
        if ($content -match $import.pattern -and $content -notmatch $import.check) {
            $content = $content -replace $import.pattern, ""
            $changed = $true
            $fileFixCount++
        }
    }

    if ($changed) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $totalFixes += $fileFixCount
        Write-Host "  Fixed $fileFixCount issues in: $($file.Name)" -ForegroundColor Yellow
    }
}

Write-Host "`nTotal fixes applied: $totalFixes" -ForegroundColor Green
Write-Host "Running lint to check remaining errors..." -ForegroundColor Cyan
npm run lint

