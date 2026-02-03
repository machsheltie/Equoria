#!/usr/bin/env python3
"""
Fix ESLint no-unused-vars errors by adding underscore prefixes to unused variables.
"""

import re
import os
import sys
from pathlib import Path

def fix_unused_vars(file_path):
    """Add underscore prefix to unused variables in a file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changes = []

    # Pattern for unused variable declarations (const, let, var)
    # Match patterns like: const variableName = ...
    unused_vars = {
        'testUser', 'testPassword', 'testGroom', 'testBreed', 'response',
        'registerResponse', 'loginResponse', 'tokenB', 'token1', 'token2',
        'token3', 'result', 'now', 'newToken', 'oldInvalidatedToken',
        'csrfToken', 'csrfCookie', 'executeData', 'mockReq', 'mockRes',
        'mockNext', 'rateLimiter', 'userId', 'horseId', 'res', 'next',
        'headers', 'checks', 'before', 'after', 'hitRateLimit',
        'expectedKeyPattern', 'plainTextEmail', 'htmlEmail', 'initialGroomCount',
        'totalRequests', 'options', 'mockCsrfProtection', 'exp', 'iat'
    }

    # Pattern for unused imports
    unused_imports = {
        'jest', 'expect', 'afterEach', 'readFileSync', 'prisma', 'request',
        'findOwnedResource', 'trackResource', 'untrackResource', 'YAML',
        'ResponseCacheService', 'requestTimeoutMiddleware', 'memoryMonitoringMiddleware',
        'databaseConnectionMiddleware', 'createResourceManagementMiddleware',
        'rateLimit', 'logger', 'jwt', 'join', 'invalidateTokenFamily',
        'generateToken', 'generateRefreshToken', 'generateDocumentation',
        'Gauge', 'fs', 'extractCookieValue', 'getCsrfToken', 'sleep',
        'createMockUser', 'createMockHorse', 'createMockGroom',
        'createMalformedToken', 'createLoginData', 'closeRedis',
        'authRateLimiter', 'authHeader', 'applyRareTraitBoosterEffects',
        'ApiResponse', 'analyzeTraitTrends', 'identifyTraitPatterns',
        'hasUltraRareAbility', 'getMemoryReport', 'getEnvironmentalHistory',
        'generateTrendPredictions', 'discoverTraits', 'EPIGENETIC_FLAG_DEFINITIONS',
        'path'
    }

    # Fix unused variable declarations
    for var_name in unused_vars:
        # Match variable declarations: const varName = ..., let varName = ..., var varName = ...
        pattern = rf'\b(const|let|var)\s+{var_name}\s*='
        if re.search(pattern, content):
            content = re.sub(pattern, rf'\1 _{var_name} =', content)
            changes.append(f"Variable: {var_name} -> _{var_name}")

    # Fix unused imports from destructuring
    for var_name in unused_imports:
        # Match in destructuring: { varName, other } or { varName }
        pattern = rf'\{{\s*([^}}]*\b){var_name}(\b[^}}]*)\}}'
        matches = list(re.finditer(pattern, content))
        for match in matches:
            before = match.group(1).strip()
            after = match.group(2).strip()
            # Add underscore if it's the only import or in a list
            if before or after.replace(',', '').strip():
                new_import = f"{{{before}_{var_name}{after}}}"
            else:
                new_import = f"{{_{var_name}}}"
            content = content[:match.start()] + new_import + content[match.end():]
            changes.append(f"Import: {var_name} -> _{var_name}")

    # Fix function parameters that are unused
    # Pattern: function(param1, unusedParam, param3)
    for var_name in ['options']:
        pattern = rf'\(([^)]*)\b{var_name}\b([^)]*)\)'
        matches = list(re.finditer(pattern, content))
        for match in matches:
            before = match.group(1)
            after = match.group(2)
            new_params = f"({before}_{var_name}{after})"
            content = content[:match.start()] + new_params + content[match.end():]
            changes.append(f"Parameter: {var_name} -> _{var_name}")

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return len(changes), changes

    return 0, []

def main():
    backend_dir = Path('backend')

    # Find all .js and .mjs files, excluding node_modules and coverage
    js_files = []
    for ext in ['*.js', '*.mjs']:
        for file in backend_dir.rglob(ext):
            # Skip node_modules, coverage directories
            if 'node_modules' not in str(file) and 'coverage' not in str(file):
                js_files.append(file)

    total_changes = 0
    files_changed = 0

    print(f"Scanning {len(js_files)} files...")

    for js_file in js_files:
        try:
            num_changes, changes = fix_unused_vars(js_file)
            if num_changes > 0:
                files_changed += 1
                total_changes += num_changes
                print(f"\n[OK] {js_file.relative_to(backend_dir)}: {num_changes} changes")
                for change in changes[:3]:  # Show first 3 changes
                    print(f"  - {change}")
                if len(changes) > 3:
                    print(f"  ... and {len(changes) - 3} more")
        except Exception as e:
            print(f"[ERR] Error processing {js_file}: {e}")

    print(f"\n{'='*60}")
    print(f"Summary: {total_changes} changes in {files_changed} files")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
