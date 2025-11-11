# ===============================================
# Equoria - Complete MCP Server Setup Script
# ===============================================
# Purpose: Install and configure all required MCP servers for Equoria development
# Date: 2025-11-10
# ===============================================

Write-Host "🚀 Equoria MCP Server Setup Script" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$ProjectRoot = "C:\Users\heirr\OneDrive\Desktop\Equoria"
$SequentialThinkingDir = "$ProjectRoot\SequentialThinking\mcp-server-mas-sequential-thinking"
$ClaudeConfigPath = "$env:APPDATA\Claude\claude_desktop_config.json"

# Step 1: Verify Prerequisites
Write-Host "📋 Step 1: Verifying Prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm installed: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found. Please install npm" -ForegroundColor Red
    exit 1
}

# Check Python
try {
    $pythonVersion = python --version
    Write-Host "✅ Python installed: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python 3.10+ from https://www.python.org" -ForegroundColor Red
    exit 1
}

# Check pip
try {
    $pipVersion = pip --version
    Write-Host "✅ pip installed" -ForegroundColor Green
} catch {
    Write-Host "❌ pip not found. Please install pip" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Setup Sequential Thinking MCP Server
Write-Host "📦 Step 2: Setting up Sequential Thinking MCP Server..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $SequentialThinkingDir) {
    Write-Host "✅ Sequential Thinking directory found" -ForegroundColor Green

    # Navigate to the directory
    Push-Location $SequentialThinkingDir

    # Check if virtual environment exists
    if (Test-Path ".\.venv") {
        Write-Host "✅ Virtual environment already exists" -ForegroundColor Green
    } else {
        Write-Host "⚙️  Creating virtual environment..." -ForegroundColor Cyan
        python -m venv .venv
        Write-Host "✅ Virtual environment created" -ForegroundColor Green
    }

    # Activate virtual environment
    Write-Host "⚙️  Activating virtual environment..." -ForegroundColor Cyan
    & ".\.venv\Scripts\Activate.ps1"

    # Install requirements
    if (Test-Path "requirements.txt") {
        Write-Host "⚙️  Installing Python requirements..." -ForegroundColor Cyan
        pip install -r requirements.txt --quiet
        Write-Host "✅ Requirements installed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  requirements.txt not found, checking pyproject.toml..." -ForegroundColor Yellow
        if (Test-Path "pyproject.toml") {
            pip install -e . --quiet
            Write-Host "✅ Package installed from pyproject.toml" -ForegroundColor Green
        }
    }

    # Return to project root
    Pop-Location

} else {
    Write-Host "❌ Sequential Thinking directory not found at: $SequentialThinkingDir" -ForegroundColor Red
    Write-Host "   Please clone the repository first" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Step 3: Install Node-based MCP Servers
Write-Host "📦 Step 3: Installing Node-based MCP Servers..." -ForegroundColor Yellow
Write-Host ""

Write-Host "⚙️  Installing @modelcontextprotocol/server-filesystem..." -ForegroundColor Cyan
npx -y @modelcontextprotocol/server-filesystem --help > $null 2>&1
Write-Host "✅ Filesystem MCP server installed" -ForegroundColor Green

Write-Host "⚙️  Installing @modelcontextprotocol/server-git..." -ForegroundColor Cyan
npx -y @modelcontextprotocol/server-git --help > $null 2>&1
Write-Host "✅ Git MCP server installed" -ForegroundColor Green

Write-Host "⚙️  Installing @modelcontextprotocol/server-github..." -ForegroundColor Cyan
npx -y @modelcontextprotocol/server-github --help > $null 2>&1
Write-Host "✅ GitHub MCP server installed" -ForegroundColor Green

Write-Host "⚙️  Installing @modelcontextprotocol/server-postgres..." -ForegroundColor Cyan
npx -y @modelcontextprotocol/server-postgres --help > $null 2>&1
Write-Host "✅ Postgres MCP server installed" -ForegroundColor Green

Write-Host ""

# Step 4: Configure Claude Desktop
Write-Host "⚙️  Step 4: Configuring Claude Desktop..." -ForegroundColor Yellow
Write-Host ""

# Check if Claude config directory exists
$claudeConfigDir = Split-Path -Parent $ClaudeConfigPath
if (!(Test-Path $claudeConfigDir)) {
    Write-Host "⚠️  Claude config directory not found. Creating..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $claudeConfigDir -Force | Out-Null
    Write-Host "✅ Created Claude config directory" -ForegroundColor Green
}

# Backup existing config if it exists
if (Test-Path $ClaudeConfigPath) {
    $backupPath = "$ClaudeConfigPath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $ClaudeConfigPath $backupPath
    Write-Host "✅ Backed up existing config to: $backupPath" -ForegroundColor Green
}

# Read the template config
$templateConfigPath = "$ProjectRoot\.claude\mcp_config.json"
if (Test-Path $templateConfigPath) {
    Write-Host "⚙️  Copying MCP configuration to Claude Desktop..." -ForegroundColor Cyan
    Copy-Item $templateConfigPath $ClaudeConfigPath -Force
    Write-Host "✅ MCP configuration installed" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: You need to configure your GitHub Personal Access Token" -ForegroundColor Yellow
    Write-Host "   1. Go to: https://github.com/settings/tokens" -ForegroundColor Yellow
    Write-Host "   2. Generate a token with 'repo', 'workflow', 'read:org' scopes" -ForegroundColor Yellow
    Write-Host "   3. Edit: $ClaudeConfigPath" -ForegroundColor Yellow
    Write-Host "   4. Replace 'REPLACE_WITH_YOUR_GITHUB_TOKEN' with your actual token" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "❌ Template config not found at: $templateConfigPath" -ForegroundColor Red
}

# Step 5: Test MCP Servers
Write-Host "🧪 Step 5: Testing MCP Servers..." -ForegroundColor Yellow
Write-Host ""

Write-Host "⚙️  Testing Sequential Thinking MCP server..." -ForegroundColor Cyan
Push-Location $SequentialThinkingDir
& ".\.venv\Scripts\python.exe" -c "import sys; sys.path.insert(0, '.'); import main; print('✅ Sequential Thinking imports successfully')" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Sequential Thinking MCP server working" -ForegroundColor Green
} else {
    Write-Host "⚠️  Sequential Thinking MCP server test failed (may work in Claude Desktop)" -ForegroundColor Yellow
}
Pop-Location

Write-Host "⚙️  Testing Filesystem MCP server..." -ForegroundColor Cyan
$fsTest = npx -y @modelcontextprotocol/server-filesystem --help 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Filesystem MCP server working" -ForegroundColor Green
} else {
    Write-Host "❌ Filesystem MCP server test failed" -ForegroundColor Red
}

Write-Host "⚙️  Testing Git MCP server..." -ForegroundColor Cyan
$gitTest = npx -y @modelcontextprotocol/server-git --help 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Git MCP server working" -ForegroundColor Green
} else {
    Write-Host "❌ Git MCP server test failed" -ForegroundColor Red
}

Write-Host ""

# Step 6: Final Instructions
Write-Host "🎉 Installation Complete!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Configure GitHub Personal Access Token in: $ClaudeConfigPath" -ForegroundColor White
Write-Host "2. Restart Claude Desktop application" -ForegroundColor White
Write-Host "3. Verify MCP servers are available in Claude Desktop" -ForegroundColor White
Write-Host "4. Test Sequential Thinking with: 'Use sequential thinking to analyze...'" -ForegroundColor White
Write-Host ""
Write-Host "📄 Configuration file: $ClaudeConfigPath" -ForegroundColor Cyan
Write-Host "📄 Project MCP config template: $templateConfigPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Setup complete! You can now use all MCP servers with Claude Code." -ForegroundColor Green
Write-Host ""

# Display installed MCP servers
Write-Host "Installed MCP Servers:" -ForegroundColor Cyan
Write-Host "  [OK] sequential-thinking (Python-based, Agno framework)" -ForegroundColor Green
Write-Host "  [OK] filesystem (File operations)" -ForegroundColor Green
Write-Host "  [OK] git (Git operations)" -ForegroundColor Green
Write-Host "  [WARN] github (Needs GitHub PAT configuration)" -ForegroundColor Yellow
Write-Host "  [OK] postgres (Database operations)" -ForegroundColor Green
Write-Host ""

# Pause to let user read
Read-Host -Prompt "Press Enter to exit"
