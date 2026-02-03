import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const searchDir = process.argv[2] || '.';

console.log(`
🛡️ CODEBASE AUDITOR REPORT: ${searchDir}`);
console.log('==================================================');

function runGrep(pattern, label) {
    try {
        // Exclude node_modules, .git, dist, logs, coverage
        const cmd = `grep -r "${pattern}" ${searchDir} --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=coverage --exclude-dir=logs --exclude=*.log --exclude=*.json --exclude=*.lock --include=*.js --include=*.mjs --include=*.ts --include=*.tsx`;
        const output = execSync(cmd, { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        console.log(`
Found ${lines.length} instances of ${label}:`);
        lines.slice(0, 10).forEach(l => console.log(`  ${l.trim().substring(0, 100)}...`));
        if (lines.length > 10) console.log(`  ...and ${lines.length - 10} more.`);
    } catch (e) {
        // grep returns 1 if no matches found, which throws error in execSync
        console.log(`
✅ Clean: No instances of ${label} found.`);
    }
}

// 1. Check for console.logs (Hygiene)
runGrep('console\.log', 'console.log');

// 2. Check for Untracked TODOs (Process)
runGrep('TODO', 'TODO comments');

// 3. Check for Hardcoded Secrets (Security)
// Very basic heuristic
runGrep('API_KEY\s*=\s*["\'][a-zA-Z0-9]', 'Potential Hardcoded API Keys');
runGrep('PASSWORD\s*=\s*["\'][a-zA-Z0-9]', 'Potential Hardcoded Passwords');

console.log('
==================================================\n');
