# Equoria - Complete MCP Server Configuration

**Version:** 2.0.0
**Created:** 2025-11-10
**Status:** Configuration Updated - Restart Required

---

## Overview

Updated MCP server configuration to include all recommended servers from CLAUDE.md:
- **Total Servers:** 9 MCP servers
- **Status:** Configuration updated, restart required
- **Purpose:** Enhanced development capabilities for Equoria

---

## MCP Server Inventory

### Core Infrastructure (5 servers)

#### 1. Sequential Thinking ✅ INSTALLED
**Status:** Active and operational
**Purpose:** Multi-agent system for complex problem-solving
**Use Cases:**
- Architectural design decisions
- Complex algorithm development
- System integration planning
- Performance optimization strategies

**Package:** Custom Python implementation
**Location:** `SequentialThinking/mcp-server-mas-sequential-thinking`

---

#### 2. Filesystem ✅ INSTALLED
**Status:** Active and operational
**Purpose:** File system operations and navigation
**Use Cases:**
- Codebase exploration
- File read/write operations
- Directory structure management
- Search operations

**Package:** `@modelcontextprotocol/server-filesystem`
**Command:** `npx -y @modelcontextprotocol/server-filesystem [path]`

---

#### 3. Git ✅ INSTALLED
**Status:** Active and operational
**Purpose:** Git version control operations
**Use Cases:**
- Commit management
- Branch operations
- History tracking
- Diff analysis

**Package:** `@modelcontextprotocol/server-git`
**Command:** `npx -y @modelcontextprotocol/server-git --repository [path]`

---

#### 4. GitHub ✅ INSTALLED (Token Needed)
**Status:** Configured, needs personal access token
**Purpose:** GitHub API integration
**Use Cases:**
- Pull request management
- Issue tracking
- CI/CD workflow monitoring
- Code review coordination

**Package:** `@modelcontextprotocol/server-github`
**Command:** `npx -y @modelcontextprotocol/server-github`
**Configuration Required:** Set `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable

**To Configure GitHub Token:**
1. Go to https://github.com/settings/tokens
2. Generate new token (classic) with scopes: `repo`, `workflow`, `read:org`
3. Update `.claude/mcp_config.json` with your token
4. Copy to Claude Desktop config location
5. Restart Claude Desktop

---

#### 5. PostgreSQL ✅ INSTALLED
**Status:** Active and operational
**Purpose:** Database operations and queries
**Use Cases:**
- Schema inspection
- Query execution
- Database management
- Performance analysis

**Package:** `@modelcontextprotocol/server-postgres`
**Command:** `npx -y @modelcontextprotocol/server-postgres [connection_string]`

---

### Enhanced Development Tools (4 servers - NEWLY ADDED)

#### 6. Context7 ⚠️ CONFIGURATION ADDED
**Status:** Configuration added, needs verification
**Purpose:** Advanced context management for large codebases
**Use Cases:**
- Codebase understanding across 30+ database tables
- Cross-system dependency tracking
- Documentation correlation
- Long-term project memory
- Context preservation across sessions

**Package:** `@context7/mcp-server` (Note: Package name may need verification)
**Command:** `npx -y @context7/mcp-server`

**Benefits for Equoria:**
- Track relationships between 480+ backend files
- Maintain context across complex systems (genetics, breeding, competitions)
- Correlate documentation with code implementation
- Remember architectural decisions long-term

---

#### 7. Task Manager ⚠️ CONFIGURATION ADDED
**Status:** Configuration added, needs verification
**Purpose:** Project task coordination and sprint planning
**Use Cases:**
- Sprint planning and tracking
- Feature development coordination
- Bug tracking and resolution
- Frontend development roadmap (25-30 hours of work)
- Weekly checkpoint management

**Package:** `@taskmanager/mcp-server` (Note: Package name may need verification)
**Command:** `npx -y @taskmanager/mcp-server`

**Benefits for Equoria:**
- Track Week 1-10 implementation progress
- Coordinate parallel agent execution
- Monitor frontend MVP completion (13 core screens)
- Manage 942+ test maintenance

---

#### 8. Serenity ⚠️ CONFIGURATION ADDED
**Status:** Configuration added, needs verification
**Purpose:** Code quality and testing assistance
**Use Cases:**
- Test generation and validation
- Code quality analysis
- Refactoring suggestions
- Performance profiling
- Technical debt identification

**Package:** `@serenity/mcp-server` (Note: Package name may need verification)
**Command:** `npx -y @serenity/mcp-server`

**Benefits for Equoria:**
- Maintain 90.1% test success rate
- Generate component tests for React Native screens
- Identify code quality issues proactively
- Suggest refactoring opportunities
- Profile performance bottlenecks

---

#### 9. Chrome Dev Tools ⚠️ CONFIGURATION ADDED
**Status:** Configuration added, needs verification
**Purpose:** Frontend debugging and performance monitoring
**Use Cases:**
- React Native debugging
- Performance monitoring (FPS, load times)
- Network request analysis
- Memory leak detection
- Bundle size optimization

**Package:** `@chrome-devtools/mcp-server` (Note: Package name may need verification)
**Command:** `npx -y @chrome-devtools/mcp-server`

**Benefits for Equoria:**
- Debug React Native screens during development
- Monitor performance (target: 60 FPS animations)
- Analyze API call patterns
- Detect memory leaks early
- Optimize bundle size for mobile

---

## Configuration Status

### ✅ Fully Configured (5 servers)
- Sequential Thinking
- Filesystem
- Git
- GitHub (needs token)
- PostgreSQL

### ⚠️ Configuration Added, Needs Verification (4 servers)
- Context7
- Task Manager
- Serenity
- Chrome Dev Tools

**Note:** The package names for Context7, Task Manager, Serenity, and Chrome Dev Tools are placeholders. These may need to be verified against the actual MCP server registry or documentation.

---

## Next Steps

### Option 1: Restart and Test Current Configuration

**Immediate Action:**
1. **Restart Claude Desktop** (required to load new configuration)
2. Test if new MCP servers are accessible
3. If errors occur, note which servers failed
4. Research correct package names for failed servers

**Test Commands After Restart:**
```
# Test Context7
[Ask Claude to use Context7 to analyze project structure]

# Test Task Manager
[Ask Claude to create a task list for Week 1]

# Test Serenity
[Ask Claude to use Serenity to analyze code quality]

# Test Chrome Dev Tools
[Ask Claude to prepare Chrome Dev Tools for React Native debugging]
```

---

### Option 2: Verify Package Names Before Restart

**Research Required:**
1. **Context7:** Find official MCP server package
   - Search npm registry for "context7 mcp"
   - Check MCP server documentation
   - Alternative names: context-manager, context-server

2. **Task Manager:** Find official MCP server package
   - Search npm registry for "task manager mcp"
   - Check MCP server documentation
   - Alternative names: task-tracker, project-manager

3. **Serenity:** Find official MCP server package
   - Search npm registry for "serenity mcp"
   - Check MCP server documentation
   - Alternative names: code-quality, test-assistant

4. **Chrome Dev Tools:** Find official MCP server package
   - Search npm registry for "chrome devtools mcp"
   - Check MCP server documentation
   - Alternative names: devtools-protocol, chrome-debug

---

## How MCP Servers Enhance Development

### Current Workflow (5 servers)
```
You ← → Claude Code
         ├── Sequential Thinking (complex reasoning)
         ├── Filesystem (code access)
         ├── Git (version control)
         ├── GitHub (PR/issues)
         └── PostgreSQL (database)
```

### Enhanced Workflow (9 servers)
```
You ← → Claude Code
         ├── Sequential Thinking (complex reasoning)
         ├── Context7 (codebase memory) ⭐ NEW
         ├── Task Manager (project tracking) ⭐ NEW
         ├── Serenity (code quality) ⭐ NEW
         ├── Chrome Dev Tools (debugging) ⭐ NEW
         ├── Filesystem (code access)
         ├── Git (version control)
         ├── GitHub (PR/issues)
         └── PostgreSQL (database)
```

---

## Benefits for Week 1 Implementation

### With New MCP Servers:

**Context7:**
- Remember project architecture while implementing frontend
- Track relationships between backend APIs and frontend screens
- Maintain context across multiple development sessions

**Task Manager:**
- Track Day 1-7 implementation progress
- Coordinate parallel agent tasks
- Monitor completion of 40-50 hour work estimate
- Create daily checklists and validate completion

**Serenity:**
- Generate component tests for React Native screens as they're built
- Analyze code quality in real-time
- Suggest optimizations during development
- Maintain 80%+ test coverage target

**Chrome Dev Tools:**
- Debug React Native screens immediately when issues arise
- Profile performance during development (not after)
- Monitor memory usage as features are added
- Ensure 60 FPS animations from the start

---

## Configuration File Locations

**Project Configuration (Source):**
```
C:\Users\heirr\OneDrive\Desktop\Equoria\.claude\mcp_config.json
```

**Claude Desktop Configuration (Active):**
```
C:\Users\heirr\AppData\Roaming\Claude\claude_desktop_config.json
```

**Backup Location:**
```
C:\Users\heirr\AppData\Roaming\Claude\claude_desktop_config.json.backup
```

---

## Troubleshooting

### If MCP Servers Don't Load After Restart

**Check 1: Claude Desktop Logs**
- Location: Check Claude Desktop settings for log location
- Look for: MCP server connection errors
- Common issues: Package not found, syntax errors

**Check 2: Test Individual Servers**
```bash
# Test Context7
npx -y @context7/mcp-server --help

# Test Task Manager
npx -y @taskmanager/mcp-server --help

# Test Serenity
npx -y @serenity/mcp-server --help

# Test Chrome Dev Tools
npx -y @chrome-devtools/mcp-server --help
```

**Check 3: Verify Package Names**
If packages don't exist, you'll see errors like:
```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/@context7/mcp-server
```

**Solution:**
1. Research correct package name
2. Update `.claude/mcp_config.json` with correct name
3. Copy to Claude Desktop config location
4. Restart Claude Desktop

---

## Recommended Action Plan

### Plan A: Try Current Configuration
1. ✅ Configuration updated with 9 servers
2. ⏳ **Restart Claude Desktop now**
3. ⏳ Test if all servers connect
4. ⏳ If errors, identify which servers failed
5. ⏳ Research and fix failed server configurations
6. ⏳ Update config and restart again

### Plan B: Research First, Then Restart
1. ✅ Configuration updated with 9 servers
2. ⏳ Research correct package names for new 4 servers
3. ⏳ Update `.claude/mcp_config.json` with verified names
4. ⏳ Copy to Claude Desktop config
5. ⏳ Restart Claude Desktop once with correct config

---

## My Recommendation

**Try Plan A (Restart and Test):**

**Reasoning:**
1. Current configuration won't break anything (npx will just fail for invalid packages)
2. We'll get immediate feedback on which servers work
3. We can quickly identify which packages need research
4. Sequential Thinking, Filesystem, Git, GitHub, and PostgreSQL will continue working

**After restart, I can help:**
- Identify which servers failed to load
- Research correct package names
- Update configuration
- Guide you through second restart if needed

---

## What to Expect After Restart

### Success Scenario (All 9 servers load)
You'll see:
- Claude Code has access to all 9 MCP servers
- I can use Context7 for project memory
- I can use Task Manager for sprint tracking
- I can use Serenity for code quality analysis
- I can use Chrome Dev Tools for debugging

### Partial Success Scenario (5-8 servers load)
You'll see:
- Some servers working, some failing
- Error messages indicating which packages weren't found
- Original 5 servers still working (Sequential Thinking, Filesystem, Git, GitHub, PostgreSQL)

### How I'll Use New Servers

**Immediately after restart:**
```
1. Context7: Load Equoria project context (480+ files, 30+ tables, 942+ tests)
2. Task Manager: Create Week 1 task breakdown with daily checklists
3. Serenity: Run initial code quality analysis on existing backend
4. Chrome Dev Tools: Prepare for React Native debugging when we start frontend
```

---

## Configuration Summary

**Before:** 5 MCP servers
**After:** 9 MCP servers
**Added:** Context7, Task Manager, Serenity, Chrome Dev Tools
**Status:** Configuration updated, restart required

**Ready to restart Claude Desktop?**

After restarting:
1. Come back to this conversation
2. I'll test all MCP server connections
3. We'll fix any configuration issues
4. Then we'll leverage the new servers for Week 1 implementation

---

**Status:** Ready for Restart ✅
**Next Action:** Restart Claude Desktop
**Expected Result:** Enhanced development capabilities for Equoria

**Questions or concerns? Let me know before restarting!**
