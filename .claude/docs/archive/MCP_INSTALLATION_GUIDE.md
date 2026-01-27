# MCP Server Installation Guide for Equoria

**Date:** 2025-11-07
**Purpose:** Step-by-step guide to install and configure all recommended MCP servers

---

## Prerequisites

Before installing MCP servers, ensure you have:

- ✅ Node.js 18+ installed
- ✅ npm or npx available
- ✅ Claude Desktop or Claude Code installed
- ✅ Terminal/Command Prompt access

**Verify Prerequisites:**

```bash
node --version  # Should show v18.x or higher
npm --version   # Should show 9.x or higher
```

---

## MCP Server Installation Methods

There are two ways to install MCP servers:

### Method 1: Claude Desktop Configuration (Recommended)

Edit your Claude Desktop configuration file to add MCP servers.

**Configuration File Location:**

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux:** `~/.config/Claude/claude_desktop_config.json`

### Method 2: Manual NPX Installation

Install each MCP server individually using npx commands.

---

## Installation Steps

### Step 1: Sequential Thinking MCP (CRITICAL)

**Purpose:** Complex problem-solving and architectural decisions

**Installation Method 1 (Claude Desktop Config):**

1. Open your Claude Desktop config file:

```bash
# Windows
notepad %APPDATA%\Claude\claude_desktop_config.json

# Mac/Linux
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

2. Add this configuration:

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    }
  }
}
```

3. Save and restart Claude Desktop

**Installation Method 2 (Manual NPX):**

```bash
npx -y @anthropic-ai/mcp-server-sequential-thinking
```

**Verification:**

- Restart Claude Desktop/Code
- Look for "sequential-thinking" in available tools
- Test with: "Use sequential thinking to analyze..."

**Status:** ⬜ Not Installed

---

### Step 2: Context7 MCP (CRITICAL)

**Purpose:** Advanced context management for large codebase (30+ tables, 100+ endpoints)

**Note:** Context7 might be a placeholder name. The actual MCP server for context management from Anthropic may have a different name. Check the latest Anthropic MCP documentation.

**Alternative: Use Filesystem MCP**

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    }
  }
}
```

**Add to Claude Desktop Config:**

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    }
  }
}
```

**Status:** ⬜ Not Installed

---

### Step 3: GitHub MCP (CRITICAL)

**Purpose:** Git operations, PR management, CI/CD monitoring

**Prerequisites:**

- GitHub Personal Access Token (PAT) with repo permissions

**Create GitHub PAT:**

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`, `read:org`
4. Copy the token

**Add to Claude Desktop Config:**

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_pat_here"
      }
    }
  }
}
```

**Replace:** `your_github_pat_here` with your actual GitHub Personal Access Token

**Status:** ⬜ Not Installed

---

### Step 4: Git MCP (HIGH PRIORITY)

**Purpose:** Local Git operations (commit, push, branch management)

**Add to Claude Desktop Config:**

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_pat_here"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    }
  }
}
```

**Status:** ⬜ Not Installed

---

### Step 5: PostgreSQL MCP (RECOMMENDED)

**Purpose:** Direct database querying and management

**Add to Claude Desktop Config:**

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_pat_here"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://user:password@localhost:5432/equoria_dev"
      ]
    }
  }
}
```

**Replace:** `postgresql://user:password@localhost:5432/equoria_dev` with your actual database connection string

**Status:** ⬜ Not Installed

---

### Step 6: Memory MCP (OPTIONAL BUT USEFUL)

**Purpose:** Persistent memory across Claude sessions

**Add to Claude Desktop Config:**

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_pat_here"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://user:password@localhost:5432/equoria_dev"
      ]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

**Status:** ⬜ Not Installed

---

## Complete Configuration File

Here's the complete `claude_desktop_config.json` with all recommended MCP servers:

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sequential-thinking"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    },
    "git": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-git",
        "--repository",
        "C:\\Users\\heirr\\OneDrive\\Desktop\\Equoria"
      ]
    },
    "postgres": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://user:password@localhost:5432/equoria_dev"
      ]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

**IMPORTANT:** Replace these placeholders:

- `ghp_your_token_here` - Your GitHub Personal Access Token
- `postgresql://user:password@localhost:5432/equoria_dev` - Your actual PostgreSQL connection string

---

## Installation Verification

After configuring and restarting Claude Desktop:

1. **Check MCP Server Status:**

   - Open Claude Desktop/Code
   - Look for available MCP tools in the tool menu
   - You should see tools from each configured server

2. **Test Sequential Thinking:**

   ```
   Prompt: "Use sequential thinking to analyze the best approach for implementing the Horse List Screen"
   ```

   - Should show step-by-step reasoning

3. **Test Filesystem:**

   ```
   Prompt: "List files in the backend directory"
   ```

   - Should show backend files

4. **Test GitHub:**

   ```
   Prompt: "Show recent commits in the Equoria repository"
   ```

   - Should show git commits

5. **Test Git:**

   ```
   Prompt: "Show current git status"
   ```

   - Should show git status

6. **Test Postgres:**
   ```
   Prompt: "Show the horses table schema"
   ```
   - Should show table structure

---

## Troubleshooting

### Issue: MCP Server Not Appearing

**Solution 1:** Restart Claude Desktop completely

- Quit Claude Desktop (File → Exit or Cmd/Ctrl+Q)
- Reopen Claude Desktop

**Solution 2:** Check Configuration File Syntax

- Ensure JSON is valid (no trailing commas, proper quotes)
- Use a JSON validator: https://jsonlint.com/

**Solution 3:** Check npx Permissions

```bash
npx --version
# Should return version number without errors
```

### Issue: GitHub MCP Not Working

**Solution:** Verify GitHub PAT has correct permissions

- Repo access
- Workflow access
- Read:org access

**Regenerate PAT if needed:**
https://github.com/settings/tokens

### Issue: Postgres MCP Connection Failed

**Solution:** Verify database connection string

```bash
psql "postgresql://user:password@localhost:5432/equoria_dev"
# Should connect successfully
```

**Check PostgreSQL is running:**

```bash
# Windows
pg_ctl status

# Mac/Linux
brew services list | grep postgresql
```

### Issue: Filesystem MCP Permission Denied

**Solution:** Ensure Claude Desktop has filesystem permissions

- Windows: Run as administrator
- Mac: System Preferences → Security & Privacy → Files and Folders
- Linux: Check file permissions on Equoria directory

---

## Post-Installation Setup

After installing all MCP servers:

1. **Update CLAUDE.md:**

   - Mark MCP servers as installed
   - Note any configuration changes

2. **Test Each MCP Server:**

   - Run verification prompts
   - Document any issues

3. **Configure Environment Variables:**

   - Set up `.env` file with credentials
   - Never commit tokens to git

4. **Begin Frontend Development:**
   - Now ready to start frontend sprint with full MCP support
   - Use Sequential Thinking for architectural decisions
   - Use Filesystem for code navigation
   - Use Git/GitHub for version control

---

## Quick Start Checklist

After installation, you should be able to:

- [ ] Use Sequential Thinking for complex decisions
- [ ] Read and search Equoria codebase with Filesystem MCP
- [ ] Create commits and PRs with Git/GitHub MCPs
- [ ] Query database with Postgres MCP
- [ ] Maintain context across sessions with Memory MCP

---

## Next Steps

1. **Complete this installation guide**
2. **Verify all MCP servers are working**
3. **Begin Frontend Development Sprint** (see CLAUDE_CODE_RECOMMENDATIONS.md)
4. **Use parallel agents** for maximum efficiency

---

## Support Resources

- **MCP Documentation:** https://modelcontextprotocol.io/
- **Anthropic MCP Servers:** https://github.com/anthropics/anthropic-tools
- **Community MCP Servers:** https://github.com/modelcontextprotocol/servers
- **Equoria Documentation:** [docs/README.md](./docs/README.md)

---

**Installation Status Tracker:**

| MCP Server          | Priority    | Status           | Notes                   |
| ------------------- | ----------- | ---------------- | ----------------------- |
| Sequential Thinking | CRITICAL    | ⬜ Not Installed |                         |
| Filesystem          | CRITICAL    | ⬜ Not Installed |                         |
| GitHub              | CRITICAL    | ⬜ Not Installed | Needs PAT               |
| Git                 | HIGH        | ⬜ Not Installed |                         |
| Postgres            | RECOMMENDED | ⬜ Not Installed | Needs connection string |
| Memory              | OPTIONAL    | ⬜ Not Installed |                         |

---

**Last Updated:** 2025-11-07
**Next Review:** After completing installation
