#!/bin/bash

# WSL2 Migration Script for NA-Agents
echo "🚀 Starting migration to WSL2..."

# Create project directory in WSL home
PROJECT_DIR="$HOME/na-agents"
echo "📁 Creating project directory: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"

# Copy all project files from Windows
echo "📋 Copying project files from Windows..."
cp -r /mnt/e/Projects/NiroAgent/na-agents/* "$PROJECT_DIR/"

# Navigate to project directory
cd "$PROJECT_DIR"

# Fix line endings (Windows CRLF to Linux LF)
echo "🔧 Fixing line endings..."
find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.sh" \) -exec dos2unix {} \; 2>/dev/null || true

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "📦 Installing GitHub CLI..."
    sudo apt update
    sudo apt install -y gh
else
    echo "✅ GitHub CLI already installed: $(gh --version | head -1)"
fi

# Install project dependencies
echo "📦 Installing project dependencies..."
npm install

# Check if GitHub Copilot extension is installed
if ! gh extension list | grep -q copilot; then
    echo "🤖 Installing GitHub Copilot CLI extension..."
    gh extension install github/gh-copilot
else
    echo "✅ GitHub Copilot CLI already installed"
fi

# Create logs directory
mkdir -p logs
mkdir -p temp
mkdir -p generated_code

# Set execute permissions on scripts
chmod +x *.sh

# Copy AWS credentials if they exist
if [ -f "/mnt/c/Users/$USER/.aws/credentials" ]; then
    echo "📋 Copying AWS credentials..."
    mkdir -p ~/.aws
    cp /mnt/c/Users/$USER/.aws/credentials ~/.aws/
    cp /mnt/c/Users/$USER/.aws/config ~/.aws/ 2>/dev/null || true
fi

echo ""
echo "✅ Migration complete!"
echo ""
echo "📍 Project location: $PROJECT_DIR"
echo ""
echo "🎯 Next steps:"
echo "1. Authenticate GitHub CLI: gh auth login"
echo "2. Start the agents: npm run dev"
echo "3. Or start individual agents:"
echo "   - npm run dev:architect"
echo "   - npm run dev:developer"
echo "   - npm run dev:devops"
echo "   - npm run dev:qa"
echo "   - npm run dev:manager"
echo ""
echo "💡 To access from Windows browser:"
echo "   The agents will be available at the same ports (5001-5005)"
echo "   Example: http://localhost:5001/health"