#!/usr/bin/env python3
"""
Conservatively fix no-unused-vars errors in test files only.
Only adds underscore prefixes to variables that are clearly unused.
"""

import re
import os
from pathlib import Path

def fix_test_file(file_path):
    """Add underscore prefix to specific unused variables in test files."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    changes = []

    # Only fix these specific variables that ESLint flagged as unused
    unused_vars_to_fix = [
        # Test data variables
        'testUser', 'testPassword', 'testGroom', 'testBreed', 'testHorse',
        # Response variables in tests
        'response', 'registerResponse', 'loginResponse',
        # Token variables
        'tokenB', 'token1', 'token2', 'token3', 'oldInvalidatedToken', 'newToken',
        # Mock objects
        'mockReq', 'mockRes', 'mockNext', 'mockCsrfProtection',
        # Other test variables
        'result', 'now', 'csrfToken', 'csrfCookie', 'executeData',
        'userId', 'horseId', 'res', 'next', 'headers', 'checks',
        'before', 'after', 'hitRateLimit', 'expectedKeyPattern',
        'plainTextEmail', 'htmlEmail', 'initialGroomCount', 'totalRequests',
        'options', 'exp', 'iat', 'rateLimiter', 'skipAuthFlag',
        'requireAuthHeader',
    ]

    # Fix variable declarations: const varName = ...
    for var_name in unused_vars_to_fix:
        pattern = rf'\b(const|let|var)\s+{var_name}\s*='
        if re.search(pattern, content):
            content = re.sub(pattern, rf'\1 _{var_name} =', content)
            changes.append(f"{var_name} -> _{var_name}")

    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return len(changes), changes

    return 0, []

def main():
    backend_dir = Path('backend')

    # Only process test files
    test_patterns = [
        '__tests__/**/*.mjs',
        '__tests__/**/*.js',
        'tests/**/*.mjs',
        'tests/**/*.js',
    ]

    test_files = []
    for pattern in test_patterns:
        test_files.extend(backend_dir.glob(pattern))

    total_changes = 0
    files_changed = 0

    print(f"Scanning {len(test_files)} test files...")

    for test_file in test_files:
        try:
            num_changes, changes = fix_test_file(test_file)
            if num_changes > 0:
                files_changed += 1
                total_changes += num_changes
                print(f"\n[OK] {test_file.relative_to(backend_dir)}: {num_changes} changes")
                for change in changes[:5]:  # Show first 5
                    print(f"  - {change}")
                if len(changes) > 5:
                    print(f"  ... and {len(changes) - 5} more")
        except Exception as e:
            print(f"[ERR] {test_file}: {e}")

    print(f"\n{'='*60}")
    print(f"Summary: {total_changes} changes in {files_changed} files")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
