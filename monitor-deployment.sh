#!/bin/bash

# Deployment Monitoring Script
# Monitors the GitHub Actions deployment and provides status updates

set -e

echo "🚀 NA-Agents Deployment Monitor"
echo "================================="
echo "Monitoring deployment progress..."
echo ""

# Function to test endpoint
test_endpoint() {
    local url=$1
    local timeout=${2:-3}
    
    if curl -s -m "$timeout" "$url" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to test all agents
test_all_agents() {
    local base_url=$1
    local results=()
    
    echo "Testing all agent endpoints:"
    
    for port in 5001 5002 5003 5004 5005; do
        agent_name=$(case $port in
            5001) echo "Architect";;
            5002) echo "Developer";;
            5003) echo "DevOps";;
            5004) echo "QA";;
            5005) echo "Manager";;
        esac)
        
        echo -n "  $agent_name ($port): "
        if test_endpoint "$base_url:$port/health" 5; then
            echo "✅ ONLINE"
            results+=("PASS")
        else
            echo "❌ OFFLINE"
            results+=("FAIL")
        fi
    done
    
    local passed=0
    for result in "${results[@]}"; do
        if [ "$result" = "PASS" ]; then
            ((passed++))
        fi
    done
    
    echo ""
    echo "Agent Status: $passed/5 agents online"
    
    if [ $passed -eq 5 ]; then
        return 0
    else
        return 1
    fi
}

# Monitor deployment progress
monitor_deployment() {
    local base_url="https://dev.agents.visualforge.ai"
    local max_attempts=40  # 40 attempts = ~20 minutes
    local attempt=1
    
    echo "Monitoring deployment at: $base_url"
    echo "Max monitoring time: ~20 minutes"
    echo ""
    
    while [ $attempt -le $max_attempts ]; do
        echo "🔍 Attempt $attempt/$max_attempts ($(date))"
        
        # Test base domain first
        echo -n "  Base domain: "
        if test_endpoint "$base_url/health" 5; then
            echo "✅ RESPONDING"
            
            # If base domain is up, test all agents
            if test_all_agents "$base_url"; then
                echo ""
                echo "🎉 DEPLOYMENT SUCCESSFUL!"
                echo "All agents are online and responding."
                echo ""
                echo "🔗 Access URLs:"
                echo "  Base URL: $base_url"
                echo "  Architect: $base_url:5001/health"
                echo "  Developer: $base_url:5002/health"
                echo "  DevOps: $base_url:5003/health"
                echo "  QA: $base_url:5004/health"
                echo "  Manager: $base_url:5005/health"
                return 0
            else
                echo "⚠️  Base domain up but some agents still starting..."
            fi
        else
            echo "❌ NOT RESPONDING"
            echo "     (DNS propagation or infrastructure still deploying)"
        fi
        
        echo ""
        
        if [ $attempt -lt $max_attempts ]; then
            echo "⏳ Waiting 30 seconds before next check..."
            sleep 30
        fi
        
        ((attempt++))
    done
    
    echo "⚠️  Deployment monitoring timed out after $max_attempts attempts."
    echo "This could mean:"
    echo "  - GitHub Actions workflow is still running"
    echo "  - AWS deployment encountered an error"
    echo "  - DNS propagation is taking longer than expected"
    echo "  - Infrastructure is still being created"
    echo ""
    echo "💡 Next steps:"
    echo "  - Check GitHub Actions workflow status at:"
    echo "    https://github.com/NiroAgent/na-agents/actions"
    echo "  - Wait longer for DNS propagation (can take up to 48 hours)"
    echo "  - Retry deployment if workflow failed"
    
    return 1
}

# Function to provide troubleshooting information
show_troubleshooting() {
    echo ""
    echo "🔧 TROUBLESHOOTING INFORMATION"
    echo "=============================="
    echo ""
    echo "1. GitHub Actions Workflow:"
    echo "   https://github.com/NiroAgent/na-agents/actions"
    echo ""
    echo "2. DNS Propagation Check:"
    echo "   https://dnschecker.org/#A/dev.agents.visualforge.ai"
    echo ""
    echo "3. Manual Testing Commands:"
    echo "   curl -v https://dev.agents.visualforge.ai/health"
    echo "   curl -v https://dev.agents.visualforge.ai:5001/health"
    echo ""
    echo "4. Expected Infrastructure:"
    echo "   - CloudFormation Stack: na-agents-dev"
    echo "   - ECS Cluster: na-agents-dev"
    echo "   - Load Balancer: targeting ports 5001-5005"
    echo "   - DNS Records: *.dev.agents.visualforge.ai"
    echo ""
}

# Main execution
main() {
    echo "Starting deployment monitoring..."
    
    if monitor_deployment; then
        echo "🎉 Monitoring completed successfully!"
        exit 0
    else
        show_troubleshooting
        exit 1
    fi
}

# Handle script arguments
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [--continuous]"
    echo ""
    echo "Options:"
    echo "  --continuous    Keep monitoring until deployment succeeds"
    echo "  --help, -h      Show this help message"
    exit 0
fi

# Run main function
main "$@"