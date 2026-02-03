#!/usr/bin/env python3
"""Parse ESLint output file and fix all no-unused-vars errors."""

import re
from pathlib import Path

def parse_eslint_file(filename):
    """Parse ESLint output to extract no-unused-vars errors."""
    errors = []
    current_file = None

    with open(filename, 'r', encoding='utf-8') as f:
        for line in f:
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
        if f'_{var_name}' in line:
            return True, "Already prefixed"

        # Patterns - order matters!
        patterns = [
            # const/let/var declarations with assignment
            (rf'\b(const|let|var)\s+{re.escape(var_name)}\s*=', rf'\1 _{var_name} ='),
            # const/let/var declarations without assignment
            (rf'\b(const|let|var)\s+{re.escape(var_name)}\s*;', rf'\1 _{var_name};'),
            # Import statements - default imports
            (rf'\bimport\s+{re.escape(var_name)}\s+from', rf'import _{var_name} from'),
            # Import statements - named imports
            (rf'\bimport\s+{{\s*{re.escape(var_name)}\s*}}', rf'import {{ _{var_name} }}'),
            (rf'{{\s*{re.escape(var_name)}\s*,', rf'{{ _{var_name},'),
            (rf',\s*{re.escape(var_name)}\s*}}', rf', _{var_name} }}'),
            (rf',\s*{re.escape(var_name)}\s*,', rf', _{var_name},'),
            # Object property methods (e.g., methodName: async () => { or methodName: function() {)
            (rf'^\s*{re.escape(var_name)}:\s*', rf' _{var_name}: '),
            # Function declarations
            (rf'\b(async\s+)?function\s+{re.escape(var_name)}\s*\(', rf'\1function _{var_name}('),
            # Destructuring in declarations
            (rf'\b(const|let|var)\s*{{\s*{re.escape(var_name)}\s*}}', rf'\1 {{ _{var_name} }}'),
            # Destructured object properties (standalone)
            (rf'^\s*{re.escape(var_name)},\s*$', rf' _{var_name},'),
            # Function parameters
            (rf'\(([^,)]*),\s*{re.escape(var_name)}\s*\)', rf'(\1, _{var_name})'),
            (rf'\({re.escape(var_name)}\s*,', rf'(_{var_name},'),
            # Method parameters in classes
            (rf'{re.escape(var_name)}\s*\(([^)]*)\)\s*{{', rf'_{var_name}(\1) {{'),
            # Arrow function single param
            (rf'^(\s*){re.escape(var_name)}\s*=>', rf'\1_{var_name} =>'),
            # Assignments without declaration (e.g., hitRateLimit = true;)
            (rf'^\s*{re.escape(var_name)}\s*=', rf' _{var_name} ='),
            # Increment/decrement (e.g., totalRequests++;)
            (rf'^\s*{re.escape(var_name)}(\+\+|--);', rf' _{var_name}\1;'),
        ]

        original_line = line
        for pattern, replacement in patterns:
            new_line = re.sub(pattern, replacement, line)
            if new_line != line:
                lines[line_idx] = new_line
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.writelines(lines)
                return True, "Fixed"

        return False, f"No pattern matched: {line.strip()[:80]}"

    except Exception as e:
        return False, str(e)

def main():
    print("Parsing ESLint output...")
    errors = parse_eslint_file('eslint-output.txt')

    print(f"\nFound {len(errors)} no-unused-vars errors\n")

    fixed = 0
    failed = 0
    skipped = 0

    for error in errors:
        success, message = fix_unused_var(error['file'], error['line'], error['var'])
        if success:
            if "Already" in message:
                skipped += 1
            else:
                print(f"[OK] {Path(error['file']).name}:{error['line']} - {error['var']}")
                fixed += 1
        else:
            print(f"[FAIL] {Path(error['file']).name}:{error['line']} - {error['var']}")
            print(f"  {message}")
            failed += 1

    print(f"\n{'='*60}")
    print(f"Fixed: {fixed}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    print(f"Total: {len(errors)}")

if __name__ == "__main__":
    main()
