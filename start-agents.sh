#!/bin/bash

echo "🚀 Starting AI Agent System..."

# Set dashboard configuration
export DASHBOARD_URL="http://98.81.93.132:7777"
export HEARTBEAT_INTERVAL="15"

echo "📊 Dashboard URL: $DASHBOARD_URL"
echo "⏱️  Heartbeat interval: ${HEARTBEAT_INTERVAL}s"

# Function to start an agent
start_agent() {
    local agent_type=$1
    local agent_id=$2
    
    echo "Starting $agent_type agent ($agent_id)..."
    
    AGENT_ID="$agent_id" AGENT_TYPE="$agent_type" DASHBOARD_URL="$DASHBOARD_URL" \
    nohup python3 cost-effective-agent-heartbeat.py > "logs/${agent_id}.log" 2>&1 &
    
    echo "Agent $agent_id started (PID: $!)"
    sleep 2
}

# Create logs directory
mkdir -p logs

# Start different types of agents
start_agent "architect" "ai-architect-001"
start_agent "developer" "ai-developer-001"
start_agent "developer" "ai-developer-002"
start_agent "devops" "ai-devops-001"
start_agent "qa" "ai-qa-001"
start_agent "manager" "ai-manager-001"

# Start additional workers
start_agent "developer" "ai-developer-003"
start_agent "devops" "ai-devops-002"
start_agent "qa" "ai-qa-002"
start_agent "architect" "ai-architect-002"

echo "✅ All agents started!"
echo "📋 Check logs in the logs/ directory"
echo "🌐 View dashboard at: http://niro-agent-dashboard-dev-816454053517.s3-website-us-east-1.amazonaws.com"

# Show running agents
echo ""
echo "🔍 Running agents:"
ps aux | grep "cost-effective-agent-heartbeat.py" | grep -v grep
