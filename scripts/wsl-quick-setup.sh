#!/bin/bash

echo "🚀 NA-Agents WSL2 Setup"
echo "========================"
echo ""

# Check if running in WSL
if ! grep -q Microsoft /proc/version; then
    echo "❌ This script must be run inside WSL2!"
    exit 1
fi

cd ~/na-agents

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20.x (will require sudo password)..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js already installed: $(node --version)"
fi

# Install GitHub CLI if not present
if ! command -v gh &> /dev/null; then
    echo "📦 Installing GitHub CLI..."
    sudo apt update
    sudo apt install -y gh
else
    echo "✅ GitHub CLI already installed"
fi

# Install dependencies
echo "📦 Installing project dependencies..."
npm install

# Check GitHub auth
echo ""
echo "🔐 Checking GitHub authentication..."
if ! gh auth status &> /dev/null; then
    echo "Please authenticate with GitHub:"
    gh auth login
fi

# Install Copilot extension
if ! gh extension list | grep -q copilot; then
    echo "🤖 Installing GitHub Copilot CLI..."
    gh extension install github/gh-copilot
else
    echo "✅ GitHub Copilot already installed"
fi

# Copy AWS credentials if they exist
if [ -f "/mnt/c/Users/$USER/.aws/credentials" ]; then
    echo "📋 Copying AWS credentials..."
    mkdir -p ~/.aws
    cp /mnt/c/Users/$USER/.aws/credentials ~/.aws/
    cp /mnt/c/Users/$USER/.aws/config ~/.aws/ 2>/dev/null || true
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 To start the agents, run:"
echo "   npm run dev"
echo ""
echo "📍 Or start individual agents:"
echo "   npm run dev:architect  # http://localhost:5001"
echo "   npm run dev:developer  # http://localhost:5002"
echo "   npm run dev:devops     # http://localhost:5003"
echo "   npm run dev:qa         # http://localhost:5004"
echo "   npm run dev:manager    # http://localhost:5005"