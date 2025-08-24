#!/bin/bash

# Monitor EC2 Deployment Progress
# Checks if TypeScript agents are running on the EC2 instance

set -e

INSTANCE_ID=${1:-i-0af59b7036f7b0b77}
REGION=${AWS_REGION:-us-east-1}

echo "🔍 Monitoring EC2 Agent Deployment"
echo "📍 Instance ID: ${INSTANCE_ID}"
echo "📍 Region: ${REGION}"
echo ""

# Function to test agent endpoint
test_agent() {
    local ip=$1
    local port=$2
    local name=$3
    
    if curl -f -s --connect-timeout 3 http://${ip}:${port}/health > /dev/null 2>&1; then
        echo "✅ ${name} agent (port ${port}): Online"
        return 0
    else
        echo "❌ ${name} agent (port ${port}): Offline"
        return 1
    fi
}

# Main monitoring loop
monitor_deployment() {
    local max_attempts=60  # 30 minutes max
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔄 Check #${attempt} - $(date '+%Y-%m-%d %H:%M:%S')"
        echo "-----------------------------------"
        
        # Try to get instance public IP
        if command -v aws &> /dev/null; then
            PUBLIC_IP=$(aws ec2 describe-instances \
                --instance-ids ${INSTANCE_ID} \
                --region ${REGION} \
                --query "Reservations[0].Instances[0].PublicIpAddress" \
                --output text 2>/dev/null || echo "")
            
            if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "None" ]; then
                echo "📍 EC2 Public IP: ${PUBLIC_IP}"
                echo ""
                
                # Test each agent
                local all_online=true
                test_agent ${PUBLIC_IP} 5001 "Architect" || all_online=false
                test_agent ${PUBLIC_IP} 5002 "Developer" || all_online=false
                test_agent ${PUBLIC_IP} 5003 "DevOps" || all_online=false
                test_agent ${PUBLIC_IP} 5004 "QA" || all_online=false
                test_agent ${PUBLIC_IP} 5005 "Manager" || all_online=false
                
                if $all_online; then
                    echo ""
                    echo "🎉 SUCCESS! All TypeScript agents are online!"
                    echo ""
                    echo "📋 Agent URLs:"
                    echo "  Architect: http://${PUBLIC_IP}:5001"
                    echo "  Developer: http://${PUBLIC_IP}:5002"
                    echo "  DevOps: http://${PUBLIC_IP}:5003"
                    echo "  QA: http://${PUBLIC_IP}:5004"
                    echo "  Manager: http://${PUBLIC_IP}:5005"
                    return 0
                fi
            else
                echo "⚠️ Could not get EC2 public IP"
            fi
        else
            echo "⚠️ AWS CLI not available, using fallback monitoring"
            
            # Fallback: Try known IPs or localhost
            for test_ip in "localhost" "127.0.0.1"; do
                echo "Testing ${test_ip}..."
                if curl -f -s --connect-timeout 2 http://${test_ip}:5001/health > /dev/null 2>&1; then
                    PUBLIC_IP=${test_ip}
                    echo "📍 Found agents at: ${PUBLIC_IP}"
                    break
                fi
            done
        fi
        
        echo ""
        
        if [ $attempt -lt $max_attempts ]; then
            echo "⏳ Waiting 30 seconds before next check..."
            sleep 30
        fi
        
        ((attempt++))
    done
    
    echo "⚠️ Timeout: Agents did not come online within 30 minutes"
    return 1
}

# Display GitHub Actions info
show_github_info() {
    echo "📊 GitHub Actions Deployment"
    echo "----------------------------"
    echo "Repository: https://github.com/NiroAgent/na-agents"
    echo "Actions: https://github.com/NiroAgent/na-agents/actions"
    echo ""
    echo "The deployment is triggered by pushing to the main branch."
    echo "Check the Actions tab for deployment progress."
    echo ""
}

# Main execution
main() {
    show_github_info
    
    echo "Starting EC2 deployment monitoring..."
    echo ""
    
    if monitor_deployment; then
        echo ""
        echo "✅ Deployment monitoring completed successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Update dashboard configuration with EC2 IP"
        echo "2. Test agent endpoints"
        echo "3. Run regression tests"
        exit 0
    else
        echo ""
        echo "❌ Deployment monitoring failed or timed out"
        echo ""
        echo "Troubleshooting:"
        echo "1. Check GitHub Actions: https://github.com/NiroAgent/na-agents/actions"
        echo "2. Verify EC2 instance is running"
        echo "3. Check agent logs on EC2"
        exit 1
    fi
}

# Run main function
main "$@"