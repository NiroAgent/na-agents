#!/bin/bash

# Deploy TypeScript NA-Agents to Existing EC2 Instance
# Updates the existing EC2 instance with new TypeScript agents

set -e

INSTANCE_ID=${1:-i-0af59b7036f7b0b77}
REGION=${AWS_REGION:-us-east-1}
KEY_PATH=${2:-~/.ssh/na-agents-key.pem}

echo "🚀 Deploying TypeScript NA-Agents to Existing EC2 Instance"
echo "📍 Instance ID: ${INSTANCE_ID}"
echo "📍 Region: ${REGION}"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is required but not installed."
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "❌ AWS credentials not configured properly."; exit 1; }

# Check instance status
echo "🔍 Checking EC2 instance status..."
INSTANCE_STATE=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --region ${REGION} \
    --query "Reservations[0].Instances[0].State.Name" \
    --output text 2>/dev/null || echo "not-found")

if [ "$INSTANCE_STATE" != "running" ]; then
    echo "❌ Instance ${INSTANCE_ID} is not running (state: ${INSTANCE_STATE})"
    exit 1
fi

# Get instance public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids ${INSTANCE_ID} \
    --region ${REGION} \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text)

echo "✅ Instance is running at IP: ${PUBLIC_IP}"

# Create deployment script
cat > deploy-typescript-agents.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo "🔄 Deploying TypeScript agents on EC2..."

# Stop existing Python agents if running
echo "⏹️ Stopping existing Python agents..."
pkill -f "ai-.*-agent.py" || true
tmux kill-server 2>/dev/null || true

# Backup existing agent directory
if [ -d /opt/ai-agents ]; then
    echo "📦 Backing up existing agents..."
    sudo mv /opt/ai-agents /opt/ai-agents-python-backup-$(date +%Y%m%d-%H%M%S)
fi

# Create new directory for TypeScript agents
echo "📁 Creating TypeScript agents directory..."
sudo mkdir -p /opt/na-agents
sudo chown ec2-user:ec2-user /opt/na-agents
cd /opt/na-agents

# Clone the TypeScript agents repository
echo "📥 Cloning TypeScript agents repository..."
if [ -d .git ]; then
    git pull origin main
else
    git clone https://github.com/NiroAgent/na-agents.git .
fi

# Install Node.js 18 if not present
if ! node --version | grep -q "v18"; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install global dependencies
echo "📦 Installing global dependencies..."
sudo npm install -g pm2 typescript ts-node

# Install project dependencies
echo "📦 Installing project dependencies..."
npm ci

# Build TypeScript code
echo "🔨 Building TypeScript code..."
npm run build

# Create environment configuration
echo "⚙️ Creating environment configuration..."
cat > .env << 'ENV_CONFIG'
NODE_ENV=production
ENVIRONMENT=dev
DASHBOARD_URL=http://dashboard.visualforge.ai:4001
AWS_REGION=us-east-1
AWS_DEFAULT_REGION=us-east-1
LOG_LEVEL=info
GITHUB_TOKEN=${GITHUB_TOKEN}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
ENV_CONFIG

# Get secrets from AWS Secrets Manager if available
if aws secretsmanager get-secret-value --secret-id github-agent-token --region us-east-1 >/dev/null 2>&1; then
    echo "🔑 Loading GitHub token from Secrets Manager..."
    GITHUB_TOKEN=$(aws secretsmanager get-secret-value --secret-id github-agent-token --region us-east-1 --query SecretString --output text)
    echo "GITHUB_TOKEN=${GITHUB_TOKEN}" >> .env
fi

if aws secretsmanager get-secret-value --secret-id visualforge-ai/api-keys/development --region us-east-1 >/dev/null 2>&1; then
    echo "🔑 Loading Anthropic API key from Secrets Manager..."
    ANTHROPIC_KEY=$(aws secretsmanager get-secret-value --secret-id visualforge-ai/api-keys/development --region us-east-1 --query SecretString --output text | jq -r .anthropic_api_key)
    echo "ANTHROPIC_API_KEY=${ANTHROPIC_KEY}" >> .env
fi

# Create PM2 ecosystem configuration
echo "📝 Creating PM2 ecosystem configuration..."
cat > ecosystem.config.js << 'PM2_CONFIG'
module.exports = {
  apps: [
    {
      name: 'architect-agent',
      script: './dist/agents/architect-agent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: 5001,
        AGENT_TYPE: 'architect',
        AGENT_ID: 'ai-architect-agent-1'
      },
      error_file: '/opt/na-agents/logs/architect-error.log',
      out_file: '/opt/na-agents/logs/architect-out.log',
      log_file: '/opt/na-agents/logs/architect-combined.log',
      time: true
    },
    {
      name: 'developer-agent',
      script: './dist/agents/developer-agent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: 5002,
        AGENT_TYPE: 'developer',
        AGENT_ID: 'ai-developer-agent-1'
      },
      error_file: '/opt/na-agents/logs/developer-error.log',
      out_file: '/opt/na-agents/logs/developer-out.log',
      log_file: '/opt/na-agents/logs/developer-combined.log',
      time: true
    },
    {
      name: 'devops-agent',
      script: './dist/agents/devops-agent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: 5003,
        AGENT_TYPE: 'devops',
        AGENT_ID: 'ai-devops-agent-1'
      },
      error_file: '/opt/na-agents/logs/devops-error.log',
      out_file: '/opt/na-agents/logs/devops-out.log',
      log_file: '/opt/na-agents/logs/devops-combined.log',
      time: true
    },
    {
      name: 'qa-agent',
      script: './dist/agents/qa-agent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: 5004,
        AGENT_TYPE: 'qa',
        AGENT_ID: 'ai-qa-agent-1'
      },
      error_file: '/opt/na-agents/logs/qa-error.log',
      out_file: '/opt/na-agents/logs/qa-out.log',
      log_file: '/opt/na-agents/logs/qa-combined.log',
      time: true
    },
    {
      name: 'manager-agent',
      script: './dist/agents/manager-agent.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: 5005,
        AGENT_TYPE: 'manager',
        AGENT_ID: 'ai-manager-agent-1'
      },
      error_file: '/opt/na-agents/logs/manager-error.log',
      out_file: '/opt/na-agents/logs/manager-out.log',
      log_file: '/opt/na-agents/logs/manager-combined.log',
      time: true
    }
  ]
};
PM2_CONFIG

# Create logs directory
echo "📁 Creating logs directory..."
mkdir -p /opt/na-agents/logs

# Stop any existing PM2 processes
echo "⏹️ Stopping existing PM2 processes..."
pm2 kill || true

# Start all TypeScript agents with PM2
echo "🚀 Starting TypeScript agents with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
echo "⚙️ Setting up PM2 startup script..."
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

# Create health check script
echo "📝 Creating health check script..."
cat > /opt/na-agents/health-check.sh << 'HEALTH_SCRIPT'
#!/bin/bash
echo "🔍 Checking TypeScript agent health..."
echo "Time: $(date)"
echo ""

all_healthy=true

for port in 5001 5002 5003 5004 5005; do
    agent_name=$(case $port in
        5001) echo "Architect";;
        5002) echo "Developer";;
        5003) echo "DevOps";;
        5004) echo "QA";;
        5005) echo "Manager";;
    esac)
    
    echo -n "${agent_name} (port ${port}): "
    if curl -f -s --connect-timeout 3 http://localhost:$port/health > /dev/null 2>&1; then
        echo "✅ Healthy"
    else
        echo "❌ Not responding"
        all_healthy=false
        # Try to restart the failed agent
        pm2 restart $(echo ${agent_name,,}-agent)
    fi
done

if $all_healthy; then
    echo ""
    echo "✅ All agents are healthy!"
else
    echo ""
    echo "⚠️ Some agents need attention. Attempted restart."
fi
HEALTH_SCRIPT

chmod +x /opt/na-agents/health-check.sh

# Add health check to cron
echo "⏰ Setting up health check cron job..."
(crontab -l 2>/dev/null | grep -v "/opt/na-agents/health-check.sh"; echo "*/5 * * * * /opt/na-agents/health-check.sh >> /opt/na-agents/logs/health-check.log 2>&1") | crontab -

# Display PM2 status
echo ""
echo "📊 Current PM2 Status:"
pm2 status

# Test agent connectivity
echo ""
echo "🧪 Testing agent connectivity..."
sleep 5  # Give agents time to start

for port in 5001 5002 5003 5004 5005; do
    agent_name=$(case $port in
        5001) echo "Architect";;
        5002) echo "Developer";;
        5003) echo "DevOps";;
        5004) echo "QA";;
        5005) echo "Manager";;
    esac)
    
    echo -n "Testing ${agent_name} agent: "
    if curl -f -s --connect-timeout 5 http://localhost:${port}/health > /dev/null; then
        echo "✅ Online"
    else
        echo "⏳ Starting..."
    fi
done

echo ""
echo "✅ TypeScript agents deployment complete!"
echo ""
echo "📋 Useful commands:"
echo "  pm2 status         - View agent status"
echo "  pm2 logs           - View all logs"
echo "  pm2 logs [name]    - View specific agent logs"
echo "  pm2 restart all    - Restart all agents"
echo "  pm2 monit          - Interactive monitoring"
DEPLOY_SCRIPT

# Deploy using SSM
echo ""
echo "📤 Deploying TypeScript agents to EC2 instance..."
echo "This may take a few minutes..."

# Send deployment script via SSM
COMMAND_ID=$(aws ssm send-command \
    --instance-ids ${INSTANCE_ID} \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[\"$(cat deploy-typescript-agents.sh | base64 -w 0)\"]" \
    --comment "Deploy TypeScript NA-Agents" \
    --timeout-seconds 600 \
    --region ${REGION} \
    --query "Command.CommandId" \
    --output text)

echo "📝 SSM Command ID: ${COMMAND_ID}"
echo "⏳ Waiting for deployment to complete..."

# Wait for command to complete
aws ssm wait command-executed \
    --command-id ${COMMAND_ID} \
    --instance-id ${INSTANCE_ID} \
    --region ${REGION} 2>/dev/null || true

# Get command result
echo ""
echo "📊 Deployment Result:"
aws ssm get-command-invocation \
    --command-id ${COMMAND_ID} \
    --instance-id ${INSTANCE_ID} \
    --region ${REGION} \
    --query "Status" \
    --output text

# Clean up
rm -f deploy-typescript-agents.sh

echo ""
echo "🎉 Deployment process initiated!"
echo ""
echo "🌐 Agent URLs:"
echo "   Architect: http://${PUBLIC_IP}:5001"
echo "   Developer: http://${PUBLIC_IP}:5002"
echo "   DevOps: http://${PUBLIC_IP}:5003"
echo "   QA: http://${PUBLIC_IP}:5004"
echo "   Manager: http://${PUBLIC_IP}:5005"
echo ""
echo "🔑 SSH Access:"
echo "   ssh -i ${KEY_PATH} ec2-user@${PUBLIC_IP}"
echo ""
echo "📊 Check agent status:"
echo "   ssh -i ${KEY_PATH} ec2-user@${PUBLIC_IP} 'pm2 status'"
echo ""
echo "📝 View logs:"
echo "   ssh -i ${KEY_PATH} ec2-user@${PUBLIC_IP} 'pm2 logs'"
echo ""

# Test connectivity after deployment
echo "🧪 Testing agent connectivity (waiting 30 seconds for startup)..."
sleep 30

for port in 5001 5002 5003 5004 5005; do
    agent_name=$(case $port in
        5001) echo "Architect";;
        5002) echo "Developer";;
        5003) echo "DevOps";;
        5004) echo "QA";;
        5005) echo "Manager";;
    esac)
    
    echo -n "  ${agent_name}: "
    if curl -f -s --connect-timeout 5 http://${PUBLIC_IP}:${port}/health > /dev/null; then
        echo "✅ Online"
    else
        echo "⏳ Still starting..."
    fi
done

echo ""
echo "✅ TypeScript agents have been deployed to EC2 instance ${INSTANCE_ID}!"
echo "🔗 Public IP: ${PUBLIC_IP}"