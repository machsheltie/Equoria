Action Steps for You
Step	Action
1	Update .eslintrc.json with stronger camelCase & ESModules enforcement
2	Add file headers to all source files reminding Copilot of naming and import/export rules
3	Ensure that no files use require() or module.exports – replace with import/export
4	Refactor any inconsistent DB property naming (e.g., task_log ➝ taskLog)
5	Use lint:fix and format before every commit to correct small inconsistencies
6	Run: npm run lint && npm run format:check and fix violations before prompting Copilot again

Things to tell copilot/cursor/augment:
// Copilot: Use the same naming as our existing schema. Use camelCase. Property names should match across files and models. E.g., `horseId`, not `horse_id`.
import { calculateStreakBonus } from '../utils/streakHelpers.js';

Comments for top of files:
// ✅ Use ESModules: import/export only, no require()
// ✅ Use camelCase for all variable and function names
// ✅ File follows project conventions defined in .eslintrc and Prettier
// ✅ This module is part of the [groom system/training system/etc.]

Reinforce ES Modules Syntax
🔑 Key ESModule differences from CommonJS:
Concept	CommonJS	ES Module Syntax
Import	const x = require()	import x from '...'
Export	module.exports = ...	export default ... or export const ...
File extension req	Not required	.js must be included in paths
Top-level await	Not supported	✅ supported in ESM

3. ESLint Errors Not Showing (Problems tab, red file highlights)
This is usually caused by:

ESLint plugin not activated in VS Code

Project settings getting overridden (e.g., wrong parser or env)

Copilot or Cursor changing type in package.json or ESLint parser

Missing .eslintignore entries

Fixes:
Ensure VS Code has ESLint extension installed

Go to Extensions > ESLint (by Dirk Baeumer)

Enable for your workspace

Check your settings.json:

json
Copy
Edit
{
  "eslint.validate": ["javascript", "javascriptreact"],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.alwaysShowStatus": true
}
Ensure .eslintrc.json is ESM-friendly
You already use ESModules—make sure the ESLint parser and env are correct:

json
Copy
Edit
{
  "env": {
    "es2021": true,
    "node": true
  },
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  }
}
Watch out for this in package.json:

json
Copy
Edit
"type": "module"
If Copilot changes this to "commonjs", ESLint might break silently.

2. Prevent ESLint Highlighting Breakage
Sometimes Copilot (or Babel) introduces hidden changes that stop lint warnings from displaying.

Here’s how to fix that:

📌 Confirm:
You have eslint and @humanwhocodes/object-schema installed

Your .eslintrc.json is valid (you've already fixed this)

You’re not mixing ESM/CommonJS (all should now be .mjs)

You’re not using Babel unless explicitly needed (removal in next step)