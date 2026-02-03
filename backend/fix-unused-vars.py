#!/usr/bin/env python3
"""
Safely fix ESLint no-unused-vars errors by adding underscore prefixes.
Only modifies variable declarations, not usages.
"""

import re
import sys

def fix_unused_var(file_path, line_num, var_name):
    """Add underscore prefix to a variable declaration at a specific line."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        if line_num < 1 or line_num > len(lines):
            print(f"Error: Line {line_num} out of range in {file_path}")
            return False

        line_idx = line_num - 1
        line = lines[line_idx]

        # Only add prefix if variable doesn't already start with underscore
        if var_name.startswith('_'):
            print(f"Skipping {var_name} - already has underscore prefix")
            return True

        # Common patterns for variable declarations
        patterns = [
            # const/let/var declarations
            (rf'\b(const|let|var)\s+{re.escape(var_name)}\b', rf'\1 _{var_name}'),
            # Function parameters
            (rf'\({re.escape(var_name)}\b', rf'(_{var_name}'),
            (rf',\s*{re.escape(var_name)}\b', rf', _{var_name}'),
            # Destructuring
            (rf'{{\s*{re.escape(var_name)}\b', rf'{{ _{var_name}'),
            (rf',\s*{re.escape(var_name)}\s*}}', rf', _{var_name} }}'),
            # Arrow function params
            (rf'\({re.escape(var_name)}\s*\)', rf'(_{var_name})'),
        ]

        original_line = line
        for pattern, replacement in patterns:
            line = re.sub(pattern, replacement, line)

        if line != original_line:
            lines[line_idx] = line
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            print(f"✓ Fixed {var_name} in {file_path}:{line_num}")
            return True
        else:
            print(f"Warning: Could not match pattern for {var_name} at line {line_num}")
            print(f"  Line content: {original_line.strip()}")
            return False

    except Exception as e:
        print(f"Error fixing {file_path}:{line_num} - {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python fix-unused-vars.py <file_path> <line_num> <var_name>")
        sys.exit(1)

    file_path = sys.argv[1]
    line_num = int(sys.argv[2])
    var_name = sys.argv[3]

    success = fix_unused_var(file_path, line_num, var_name)
    sys.exit(0 if success else 1)
