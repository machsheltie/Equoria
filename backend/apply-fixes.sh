#!/bin/bash
# Parse ESLint output and apply fixes for no-unused-vars errors

echo "Parsing ESLint no-unused-vars errors..."

# Get ESLint output and extract file:line:var_name
npx eslint . 2>&1 | grep "no-unused-vars" | while IFS= read -r line; do
    # Extract line number
    if [[ $line =~ ([0-9]+):([0-9]+) ]]; then
        line_num="${BASH_REMATCH[1]}"

        # Extract variable name from error message
        if [[ $line =~ \'([^\']+)\'\ is ]]; then
            var_name="${BASH_REMATCH[1]}"

            # Get the file from the previous line
            # This is a simplified approach - store current file context
            echo "Line $line_num: $var_name"
        fi
    fi
done
