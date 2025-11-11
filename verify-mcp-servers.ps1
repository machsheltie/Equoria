# ===============================================
# Equoria - MCP Server Verification Script
# ===============================================
# Purpose: Verify all MCP servers are properly installed and running
# Date: 2025-11-10
# ===============================================

Write-Host "🔍 Equoria MCP Server Verification" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ClaudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$ProjectRoot = "C:\Users\heirr\OneDrive\Desktop\Equoria"
$SequentialThinkingDir = "$ProjectRoot\SequentialThinking\mcp-server-mas-sequential-thinking"

$allPassed = $true

# Function to test MCP server
function Test-MCPServer {
    param (
        [string]$ServerName,
        [string]$TestCommand,
        [string]$Description
    )

    Write-Host "Testing $ServerName..." -ForegroundColor Cyan
    Write-Host "  Description: $Description" -ForegroundColor Gray

    try {
        $result = Invoke-Expression $TestCommand 2>&1
        if ($LASTEXITCODE -eq 0 -or $result -match "help|usage|options") {
            Write-Host "  ✅ $ServerName is working" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ❌ $ServerName test failed" -ForegroundColor Red
            Write-Host "  Error: $result" -ForegroundColor Gray
            return $false
        }
    } catch {
        Write-Host "  ❌ $ServerName not found or not working" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Gray
        return $false
    }
    Write-Host ""
}

# Check 1: Claude Desktop Configuration
Write-Host "📋 Check 1: Claude Desktop Configuration" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $ClaudeConfigPath) {
    Write-Host "✅ Claude Desktop config found at: $ClaudeConfigPath" -ForegroundColor Green

    # Read and parse the config
    try {
        $config = Get-Content $ClaudeConfigPath | ConvertFrom-Json
        if ($config.mcpServers) {
            Write-Host "✅ MCP servers configured:" -ForegroundColor Green
            $config.mcpServers.PSObject.Properties | ForEach-Object {
                Write-Host "   - $($_.Name)" -ForegroundColor Cyan
            }

            # Check for GitHub token
            if ($config.mcpServers.github) {
                $githubToken = $config.mcpServers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN
                if ($githubToken -eq "REPLACE_WITH_YOUR_GITHUB_TOKEN") {
                    Write-Host "⚠️  GitHub token not configured yet" -ForegroundColor Yellow
                    Write-Host "   Please update the token in: $ClaudeConfigPath" -ForegroundColor Yellow
                } else {
                    Write-Host "✅ GitHub token is configured" -ForegroundColor Green
                }
            }
        } else {
            Write-Host "⚠️  No MCP servers found in config" -ForegroundColor Yellow
            $allPassed = $false
        }
    } catch {
        Write-Host "❌ Error reading config: $_" -ForegroundColor Red
        $allPassed = $false
    }
} else {
    Write-Host "❌ Claude Desktop config not found" -ForegroundColor Red
    Write-Host "   Expected at: $ClaudeConfigPath" -ForegroundColor Gray
    $allPassed = $false
}
Write-Host ""

# Check 2: Sequential Thinking MCP Server
Write-Host "📋 Check 2: Sequential Thinking MCP Server" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $SequentialThinkingDir) {
    Write-Host "✅ Sequential Thinking directory found" -ForegroundColor Green

    # Check virtual environment
    if (Test-Path "$SequentialThinkingDir\.venv") {
        Write-Host "✅ Virtual environment exists" -ForegroundColor Green

        # Test Python import
        Push-Location $SequentialThinkingDir
        $pythonTest = & ".\.venv\Scripts\python.exe" -c "import sys; sys.path.insert(0, '.'); import main; print('SUCCESS')" 2>&1
        Pop-Location

        if ($pythonTest -match "SUCCESS") {
            Write-Host "✅ Sequential Thinking imports successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ Sequential Thinking import failed" -ForegroundColor Red
            Write-Host "   Error: $pythonTest" -ForegroundColor Gray
            $allPassed = $false
        }
    } else {
        Write-Host "❌ Virtual environment not found" -ForegroundColor Red
        Write-Host "   Run setup-mcp-servers.ps1 to create it" -ForegroundColor Yellow
        $allPassed = $false
    }
} else {
    Write-Host "❌ Sequential Thinking directory not found" -ForegroundColor Red
    $allPassed = $false
}
Write-Host ""

# Check 3: Node-based MCP Servers
Write-Host "📋 Check 3: Node-based MCP Servers" -ForegroundColor Yellow
Write-Host ""

$nodeServers = @(
    @{
        Name = "Filesystem MCP"
        Command = "npx -y @modelcontextprotocol/server-filesystem --help"
        Description = "File system operations"
    },
    @{
        Name = "Git MCP"
        Command = "npx -y @modelcontextprotocol/server-git --help"
        Description = "Git operations"
    },
    @{
        Name = "GitHub MCP"
        Command = "npx -y @modelcontextprotocol/server-github --help"
        Description = "GitHub integration"
    },
    @{
        Name = "Postgres MCP"
        Command = "npx -y @modelcontextprotocol/server-postgres --help"
        Description = "PostgreSQL operations"
    }
)

foreach ($server in $nodeServers) {
    $result = Test-MCPServer -ServerName $server.Name -TestCommand $server.Command -Description $server.Description
    if (!$result) {
        $allPassed = $false
    }
}

# Check 4: Prerequisites
Write-Host "📋 Check 4: Prerequisites" -ForegroundColor Yellow
Write-Host ""

# Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    $allPassed = $false
}

# npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found" -ForegroundColor Red
    $allPassed = $false
}

# Python
try {
    $pythonVersion = python --version
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found" -ForegroundColor Red
    $allPassed = $false
}

# pip
try {
    $pipVersion = pip --version
    Write-Host "✅ pip installed" -ForegroundColor Green
} catch {
    Write-Host "❌ pip not found" -ForegroundColor Red
    $allPassed = $false
}

Write-Host ""

# Check 5: Database Connection (Optional)
Write-Host "📋 Check 5: Database Connection (Optional)" -ForegroundColor Yellow
Write-Host ""

# Check if PostgreSQL is running
try {
    $pgTest = & psql --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL client installed" -ForegroundColor Green

        # Try to connect to the database
        $dbTest = & psql -h localhost -U postgres -d equoria -c "SELECT 1;" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database connection successful" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Database not accessible (may need to be started)" -ForegroundColor Yellow
            Write-Host "   This is optional and won't affect MCP server functionality" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  PostgreSQL client not found" -ForegroundColor Yellow
        Write-Host "   Database MCP server will work when PostgreSQL is available" -ForegroundColor Gray
    }
} catch {
    Write-Host "⚠️  PostgreSQL check skipped" -ForegroundColor Yellow
}

Write-Host ""

# Final Summary
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "📊 Verification Summary" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

if ($allPassed) {
    Write-Host "🎉 All critical MCP servers verified successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ You can now:" -ForegroundColor Green
    Write-Host "   1. Restart Claude Desktop" -ForegroundColor White
    Write-Host "   2. Use MCP tools in your conversations" -ForegroundColor White
    Write-Host "   3. Begin frontend development with agent orchestration" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "⚠️  Some MCP servers need attention" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📋 Next Steps:" -ForegroundColor Yellow
    Write-Host "   1. Review errors above" -ForegroundColor White
    Write-Host "   2. Run: .\setup-mcp-servers.ps1" -ForegroundColor White
    Write-Host "   3. Configure GitHub token if needed" -ForegroundColor White
    Write-Host "   4. Restart Claude Desktop" -ForegroundColor White
    Write-Host ""
}

Write-Host "📄 Configuration: $ClaudeConfigPath" -ForegroundColor Cyan
Write-Host "📄 Project root: $ProjectRoot" -ForegroundColor Cyan
Write-Host ""

# Pause to let user read
Read-Host "Press Enter to exit"
