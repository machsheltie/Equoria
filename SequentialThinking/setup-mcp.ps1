# PowerShell Script: setup-mcp.ps1
# Location: C:\Users\heirr\OneDrive\Desktop\SequentialThinking\setup-mcp.ps1

# Desired target path
$TargetDir = "C:\Users\heirr\OneDrive\Desktop\SequentialThinking\mcp-server-mas-sequential-thinking"

# Clone the repo if not present
if (!(Test-Path -Path $TargetDir)) {
    git clone https://github.com/FradSer/mcp-server-mas-sequential-thinking.git $TargetDir
} else {
    Write-Output "✅ MCP Server folder already exists. Skipping clone."
}

# Change to the correct folder
Set-Location -Path $TargetDir

# Create virtual environment if needed
if (!(Test-Path ".venv")) {
    python -m venv .venv
}

# Activate the venv
. .\.venv\Scripts\Activate.ps1

# Install requirements
$ReqFile = Join-Path $TargetDir "requirements.txt"
if (Test-Path $ReqFile) {
    pip install -r $ReqFile
    Write-Output "✅ Requirements installed successfully."
} else {
    Write-Error "❌ requirements.txt not found at: $ReqFile"
}
