#!/usr/bin/env python3
"""
Parse ESLint output and fix all no-unused-vars errors.
"""

import re
import subprocess
from pathlib import Path

def run_eslint():
    """Run ESLint and get the output."""
    result = subprocess.run(
        ['npx', 'eslint', '.'],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent
    )
    return result.stdout + result.stderr

def parse_eslint_output(output):
    """Parse ESLint output to extract no-unused-vars errors."""
    errors = []
    current_file = None

    for line in output.split('\n'):
        # Check for file path
        if line.startswith('C:\\'):
            current_file = line.strip()
        # Check for no-unused-vars error
        elif 'no-unused-vars' in line and current_file:
            # Extract line number and variable name
            match = re.match(r'\s*(\d+):\d+\s+error\s+\'([^\']+)\'', line)
            if match:
                line_num = int(match.group(1))
                var_name = match.group(2)
                errors.append({
                    'file': current_file,
                    'line': line_num,
                    'var': var_name
                })

    return errors

def fix_unused_var(file_path, line_num, var_name):
    """Add underscore prefix to a variable declaration."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        if line_num < 1 or line_num > len(lines):
            return False, f"Line {line_num} out of range"

        line_idx = line_num - 1
        line = lines[line_idx]

        # Skip if already has underscore
        if var_name.startswith('_'):
            return True, "Already prefixed"

        # Patterns for variable declarations
        patterns = [
            (rf'\b(const|let|var)\s+{re.escape(var_name)}\b', rf'\1 _{var_name}'),
            (rf'\(([^,)]*,\s*)?{re.escape(var_name)}([,\s)])', rf'(\1_{var_name}\2'),
            (rf'{{\s*{re.escape(var_name)}\s*([,}}])', rf'{{ _{var_name}\1'),
        ]

        original_line = line
        for pattern, replacement in patterns:
            new_line = re.sub(pattern, replacement, line)
            if new_line != line:
                lines[line_idx] = new_line
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                return True, "Fixed"

        return False, f"No pattern matched for line: {line.strip()[:60]}"

    except Exception as e:
        return False, str(e)

def main():
    print("Running ESLint...")
    output = run_eslint()

    print("\nParsing errors...")
    errors = parse_eslint_output(output)

    print(f"\nFound {len(errors)} no-unused-vars errors to fix\n")

    fixed = 0
    failed = 0

    for error in errors:
        success, message = fix_unused_var(error['file'], error['line'], error['var'])
        if success:
            print(f"✓ {error['file']}:{error['line']} - {error['var']}")
            fixed += 1
        else:
            print(f"✗ {error['file']}:{error['line']} - {error['var']} - {message}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Fixed: {fixed}")
    print(f"Failed: {failed}")
    print(f"Total: {len(errors)}")

if __name__ == "__main__":
    main()
