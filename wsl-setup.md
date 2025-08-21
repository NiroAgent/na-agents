# WSL2 Setup Instructions for NA-Agents

## Quick Setup Commands

Open WSL2 Ubuntu terminal and run these commands:

```bash
# 1. Navigate to the project (already copied)
cd ~/na-agents

# 2. Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install GitHub CLI
sudo apt update
sudo apt install -y gh

# 4. Install project dependencies
npm install

# 5. Install GitHub Copilot CLI extension
gh auth login  # Follow prompts to authenticate
gh extension install github/gh-copilot

# 6. Copy AWS credentials from Windows (if needed)
mkdir -p ~/.aws
cp /mnt/c/Users/$USER/.aws/credentials ~/.aws/
cp /mnt/c/Users/$USER/.aws/config ~/.aws/

# 7. Start the agents
npm run dev

# Or start individual agents:
npm run dev:architect  # Port 5001
npm run dev:developer  # Port 5002
npm run dev:devops     # Port 5003
npm run dev:qa         # Port 5004
npm run dev:manager    # Port 5005
```

## Access from Windows

Once running in WSL2, you can access the agents from your Windows browser:
- Architect: http://localhost:5001/health
- Developer: http://localhost:5002/health
- DevOps: http://localhost:5003/health
- QA: http://localhost:5004/health
- Manager: http://localhost:5005/health

## Test GitHub Copilot

```bash
# Test that Copilot works in Linux
cd ~/na-agents
node test-copilot.js
```

## Troubleshooting

If ports are busy:
```bash
# Kill all Node.js processes
pkill -f node

# Or find specific port
lsof -i :5001
kill -9 <PID>
```

If Copilot doesn't work:
```bash
# Re-authenticate
gh auth refresh
gh copilot config
```