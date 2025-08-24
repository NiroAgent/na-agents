#!/bin/bash

# Verify Actual Deployment Status
# Tests multiple potential locations for the TypeScript agents

echo "🔍 NA-Agents Deployment Verification"
echo "===================================="
echo ""

# Function to test endpoint
test_endpoint() {
    local url=$1
    local description=$2
    local timeout=${3:-3}
    
    echo -n "Testing $description: "
    if curl -f -s --connect-timeout $timeout "$url" >/dev/null 2>&1; then
        echo "✅ Online"
        return 0
    else
        echo "❌ Offline"
        return 1
    fi
}

# Function to test all agent ports for a given IP
test_all_agents() {
    local ip=$1
    local description=$2
    
    echo ""
    echo "🚀 Testing $description"
    echo "----------------------------------------"
    
    local online_count=0
    for port in 5001 5002 5003 5004 5005; do
        agent_name=$(case $port in
            5001) echo "Architect";;
            5002) echo "Developer";;
            5003) echo "DevOps";;
            5004) echo "QA";;
            5005) echo "Manager";;
        esac)
        
        if test_endpoint "http://$ip:$port/health" "$agent_name ($port)"; then
            ((online_count++))
        fi
    done
    
    echo "Result: $online_count/5 agents online"
    
    if [ $online_count -eq 5 ]; then
        echo ""
        echo "🎉 SUCCESS! All agents are online at $ip"
        echo ""
        echo "📋 Agent URLs:"
        echo "  Architect: http://$ip:5001"
        echo "  Developer: http://$ip:5002"
        echo "  DevOps: http://$ip:5003"
        echo "  QA: http://$ip:5004"
        echo "  Manager: http://$ip:5005"
        return 0
    fi
    
    return 1
}

# Test locations in order of priority
echo "Testing potential deployment locations..."

# 1. Test localhost (local development)
test_all_agents "localhost" "Local Development (localhost)" && exit 0

# 2. Test 127.0.0.1 (local fallback)
test_all_agents "127.0.0.1" "Local Development (127.0.0.1)" && exit 0

# 3. Test known EC2 IPs from documentation
test_all_agents "98.81.93.132" "EC2 Instance (98.81.93.132)" && exit 0
test_all_agents "35.174.174.116" "EC2 Instance (35.174.174.116)" && exit 0

# 4. Test DNS names if configured
test_all_agents "dev.agents.visualforge.ai" "DNS (dev.agents.visualforge.ai)" && exit 0
test_all_agents "ec2-agents.visualforge.ai" "DNS (ec2-agents.visualforge.ai)" && exit 0

echo ""
echo "🔍 Additional Checks"
echo "--------------------"

# Test if DNS resolves
echo -n "DNS Resolution (dev.agents.visualforge.ai): "
if ping -c 1 dev.agents.visualforge.ai >/dev/null 2>&1; then
    echo "✅ Resolves"
else
    echo "❌ No resolution"
fi

# Test dashboard connectivity
echo -n "Dashboard API: "
if curl -f -s --connect-timeout 3 http://localhost:4001/api/dashboard/agents >/dev/null 2>&1; then
    echo "✅ Dashboard API responding"
else
    echo "❌ Dashboard API not responding"
fi

echo ""
echo "❌ DEPLOYMENT VERIFICATION FAILED"
echo ""
echo "💡 Possible Issues:"
echo "  1. GitHub Actions deployment is still running"
echo "  2. EC2 instance is not accessible from this location"
echo "  3. TypeScript agents failed to start on EC2"
echo "  4. Security groups blocking access"
echo "  5. DNS propagation not complete"
echo ""
echo "🔧 Troubleshooting Steps:"
echo "  1. Check GitHub Actions: https://github.com/NiroAgent/na-agents/actions"
echo "  2. Verify EC2 instance status in AWS Console"
echo "  3. Check agent logs on EC2 via SSH or SSM"
echo "  4. Ensure security groups allow ports 5001-5005"
echo "  5. Wait for DNS propagation (up to 48 hours)"

exit 1