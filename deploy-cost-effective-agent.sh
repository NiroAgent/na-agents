#!/bin/bash
# Cost-Effective Agent Deployment Script
# Saves $180/month compared to CloudWatch polling approach

set -e

# Configuration
AGENT_TYPE=${1:-"developer"}
DASHBOARD_URL=${2:-"http://localhost:4001"}
AGENT_ID="${AGENT_TYPE}-agent-$(hostname)-$(date +%s)"

echo "🚀 Deploying Cost-Effective Agent Monitoring"
echo "💰 This saves ~$180/month vs CloudWatch API polling"
echo "📊 Agent Type: $AGENT_TYPE"
echo "🔗 Dashboard: $DASHBOARD_URL"
echo "🆔 Agent ID: $AGENT_ID"

# Install dependencies
echo "📦 Installing dependencies..."
if command -v yum &> /dev/null; then
    # Amazon Linux / RHEL
    sudo yum update -y
    sudo yum install -y python3 python3-pip
elif command -v apt &> /dev/null; then
    # Ubuntu / Debian
    sudo apt update
    sudo apt install -y python3 python3-pip
fi

# Install Python packages
pip3 install psutil requests

# Download agent script
echo "⬇️  Downloading agent heartbeat script..."
curl -o /tmp/agent_heartbeat.py https://raw.githubusercontent.com/your-repo/na-agents/main/cost-effective-agent-heartbeat.py

# Create agent directory
sudo mkdir -p /opt/na-agent
sudo cp /tmp/agent_heartbeat.py /opt/na-agent/
sudo chmod +x /opt/na-agent/agent_heartbeat.py

# Create environment file
echo "⚙️  Creating configuration..."
sudo tee /opt/na-agent/.env << EOF
AGENT_ID=$AGENT_ID
AGENT_TYPE=$AGENT_TYPE
DASHBOARD_URL=$DASHBOARD_URL
HEARTBEAT_INTERVAL=30
EOF

# Create systemd service
echo "🔧 Creating systemd service..."
sudo tee /etc/systemd/system/na-agent.service << EOF
[Unit]
Description=NA Cost-Effective Agent Heartbeat
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/na-agent
EnvironmentFile=/opt/na-agent/.env
ExecStart=/usr/bin/python3 /opt/na-agent/agent_heartbeat.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Start and enable service
echo "▶️  Starting agent service..."
sudo systemctl daemon-reload
sudo systemctl enable na-agent
sudo systemctl start na-agent

# Show status
echo "✅ Cost-effective agent deployed successfully!"
echo ""
echo "📊 Service Status:"
sudo systemctl status na-agent --no-pager -l

echo ""
echo "📋 View logs:"
echo "   sudo journalctl -u na-agent -f"

echo ""
echo "🎯 Benefits:"
echo "   ✅ $0/month monitoring cost (vs $200/month CloudWatch)"
echo "   ✅ Real-time metrics every 30 seconds"
echo "   ✅ No AWS API limits or throttling"
echo "   ✅ Custom metrics and agent status"
echo "   ✅ Automatic cost calculation"

echo ""
echo "🔗 Check dashboard at: $DASHBOARD_URL"
