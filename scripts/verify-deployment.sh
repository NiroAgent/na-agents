#!/bin/bash

# Deployment Verification Script for NA-Agents
# This script verifies that all components are properly deployed and functioning

set -e

ENVIRONMENT=${1:-dev}
BASE_URL=${2:-""}
TIMEOUT=30
RETRY_ATTEMPTS=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 NA-Agents Deployment Verification${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)${NC}"
echo ""

# Function to check HTTP endpoint
check_endpoint() {
    local url=$1
    local description=$2
    local expected_status=${3:-200}
    
    echo -n -e "  Checking ${description}... "
    
    for attempt in $(seq 1 $RETRY_ATTEMPTS); do
        if response=$(curl -s -w "%{http_code}" -o /dev/null --max-time $TIMEOUT "$url" 2>/dev/null); then
            if [ "$response" -eq "$expected_status" ]; then
                echo -e "${GREEN}✅ OK (${response})${NC}"
                return 0
            else
                echo -e "${RED}❌ Failed (HTTP ${response})${NC}"
                return 1
            fi
        else
            if [ $attempt -lt $RETRY_ATTEMPTS ]; then
                echo -n -e "${YELLOW}⏳ Retry ${attempt}/${RETRY_ATTEMPTS}... ${NC}"
                sleep 5
            else
                echo -e "${RED}❌ Connection failed after ${RETRY_ATTEMPTS} attempts${NC}"
                return 1
            fi
        fi
    done
}

# Function to check agent endpoint with detailed validation
check_agent() {
    local port=$1
    local agent_name=$2
    local agent_id=$3
    
    echo -e "${BLUE}🤖 Testing ${agent_name} Agent (Port ${port}):${NC}"
    
    # Health check
    check_endpoint "${BASE_URL}:${port}/health" "Health endpoint"
    
    # Agent status
    check_endpoint "${BASE_URL}:${port}/agent/${agent_id}/status" "Agent status endpoint"
    
    # Test a simple task (non-blocking)
    echo -n -e "  Testing task endpoint... "
    if response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d '{"taskId":"verify-'$(date +%s)'","task":"Health check task","priority":"low","context":{"test":true}}' \
        --max-time $TIMEOUT "${BASE_URL}:${port}/agent/${agent_id}/task" 2>/dev/null); then
        if echo "$response" | grep -q '"taskId"'; then
            echo -e "${GREEN}✅ OK${NC}"
        else
            echo -e "${YELLOW}⚠️  Response received but format unexpected${NC}"
            echo "    Response: $response" | head -c 100
        fi
    else
        echo -e "${RED}❌ Failed${NC}"
    fi
    
    echo ""
}

# Function to determine base URL if not provided
determine_base_url() {
    if [ -z "$BASE_URL" ]; then
        case $ENVIRONMENT in
            "local")
                BASE_URL="http://localhost"
                ;;
            "dev")
                # Try to get from CloudFormation if AWS CLI is available
                if command -v aws >/dev/null 2>&1; then
                    echo -e "${BLUE}🔍 Retrieving dev load balancer URL from AWS...${NC}"
                    LB_DNS=$(aws cloudformation describe-stacks \
                        --stack-name na-agents-dev \
                        --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" \
                        --output text 2>/dev/null || echo "")
                    if [ -n "$LB_DNS" ]; then
                        BASE_URL="http://$LB_DNS"
                        echo -e "${GREEN}✅ Found load balancer: $BASE_URL${NC}"
                    else
                        echo -e "${RED}❌ Could not retrieve load balancer URL${NC}"
                        echo -e "${YELLOW}💡 Please provide BASE_URL as second argument${NC}"
                        exit 1
                    fi
                else
                    echo -e "${RED}❌ AWS CLI not available and no BASE_URL provided${NC}"
                    exit 1
                fi
                ;;
            "stg")
                if command -v aws >/dev/null 2>&1; then
                    echo -e "${BLUE}🔍 Retrieving stg load balancer URL from AWS...${NC}"
                    LB_DNS=$(aws cloudformation describe-stacks \
                        --stack-name na-agents-stg \
                        --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" \
                        --output text 2>/dev/null || echo "")
                    if [ -n "$LB_DNS" ]; then
                        BASE_URL="http://$LB_DNS"
                        echo -e "${GREEN}✅ Found load balancer: $BASE_URL${NC}"
                    else
                        echo -e "${RED}❌ Could not retrieve load balancer URL${NC}"
                        exit 1
                    fi
                else
                    echo -e "${RED}❌ AWS CLI not available and no BASE_URL provided${NC}"
                    exit 1
                fi
                ;;
            "prd")
                BASE_URL="https://visualforge.ai"
                ;;
            *)
                echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
                echo -e "${YELLOW}💡 Supported environments: local, dev, stg, prd${NC}"
                echo -e "${YELLOW}💡 Please provide BASE_URL as second argument${NC}"
                exit 1
                ;;
        esac
    fi
    
    echo -e "${BLUE}🌐 Base URL: $BASE_URL${NC}"
    echo ""
}

# Function to check supporting services
check_services() {
    echo -e "${BLUE}🔧 Testing Supporting Services:${NC}"
    
    # Chat Interface
    if check_endpoint "${BASE_URL}:7000/health" "Chat Interface (Port 7000)"; then
        check_endpoint "${BASE_URL}:7000" "Chat UI" 200
    fi
    
    # GitHub Service (if configured)
    check_endpoint "${BASE_URL}:6000/health" "GitHub Service (Port 6000)" || echo -e "${YELLOW}  Note: GitHub service may not be running if GITHUB_TOKEN not configured${NC}"
    
    echo ""
}

# Function to run comprehensive tests
run_comprehensive_tests() {
    echo -e "${BLUE}🧪 Running Comprehensive Tests:${NC}"
    
    # Test agent communication
    echo -n -e "  Testing inter-agent communication... "
    
    # Send a task to architect agent that should cascade to other agents
    task_payload='{
        "taskId": "integration-test-'$(date +%s)'",
        "task": "Design a simple REST API for user management",
        "priority": "medium",
        "context": {
            "project": "test-project",
            "notifyDeveloper": false,
            "integration_test": true
        }
    }'
    
    if response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "$task_payload" \
        --max-time 30 "${BASE_URL}:5001/agent/ai-architect-agent-1/task" 2>/dev/null); then
        if echo "$response" | grep -q '"status".*"completed"'; then
            echo -e "${GREEN}✅ Integration test passed${NC}"
        elif echo "$response" | grep -q '"status"'; then
            echo -e "${YELLOW}⚠️  Task accepted but may still be processing${NC}"
        else
            echo -e "${RED}❌ Unexpected response${NC}"
        fi
    else
        echo -e "${RED}❌ Communication test failed${NC}"
    fi
    
    echo ""
}

# Function to check system resources (if available)
check_system_resources() {
    if [ "$ENVIRONMENT" = "local" ] || [ "$ENVIRONMENT" = "dev" ]; then
        echo -e "${BLUE}💻 System Resource Check:${NC}"
        
        # Check if processes are running locally
        echo -n -e "  Node.js processes... "
        if pgrep -f "node.*agent" > /dev/null; then
            echo -e "${GREEN}✅ Found running Node.js agents${NC}"
        else
            echo -e "${YELLOW}⚠️  No local Node.js agent processes found${NC}"
        fi
        
        # Check Docker containers if docker is available
        if command -v docker >/dev/null 2>&1; then
            echo -n -e "  Docker containers... "
            if docker ps --filter "name=agent" --format "table {{.Names}}" | grep -q "agent"; then
                echo -e "${GREEN}✅ Found running agent containers${NC}"
                docker ps --filter "name=agent" --format "  - {{.Names}} ({{.Status}})"
            else
                echo -e "${YELLOW}⚠️  No agent containers found${NC}"
            fi
        fi
        
        echo ""
    fi
}

# Function to generate summary report
generate_summary() {
    local exit_code=$1
    
    echo -e "${BLUE}📊 Verification Summary:${NC}"
    echo -e "Environment: $ENVIRONMENT"
    echo -e "Base URL: $BASE_URL"
    echo -e "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    
    if [ $exit_code -eq 0 ]; then
        echo -e "Status: ${GREEN}✅ All checks passed${NC}"
        echo ""
        echo -e "${GREEN}🎉 Deployment verification successful!${NC}"
        echo -e "The NA-Agents system is running correctly in the $ENVIRONMENT environment."
    else
        echo -e "Status: ${RED}❌ Some checks failed${NC}"
        echo ""
        echo -e "${RED}⚠️  Deployment verification failed!${NC}"
        echo -e "Please check the failed endpoints and retry deployment if necessary."
        echo ""
        echo -e "${YELLOW}💡 Troubleshooting tips:${NC}"
        echo -e "  - Check if all services are started and healthy"
        echo -e "  - Verify environment variables are configured correctly"
        echo -e "  - Check CloudFormation stack status (for AWS deployments)"
        echo -e "  - Review application logs for errors"
        echo -e "  - Ensure all required ports are accessible"
    fi
}

# Main verification flow
main() {
    local overall_status=0
    
    # Determine base URL
    determine_base_url
    
    # Wait for services to be ready
    echo -e "${BLUE}⏳ Waiting for services to be ready...${NC}"
    sleep 5
    
    # Test each agent
    check_agent 5001 "Architect" "ai-architect-agent-1" || overall_status=1
    check_agent 5002 "Developer" "ai-developer-agent-1" || overall_status=1
    check_agent 5003 "DevOps" "ai-devops-agent-1" || overall_status=1
    check_agent 5004 "QA" "ai-qa-agent-1" || overall_status=1
    check_agent 5005 "Manager" "ai-manager-agent-1" || overall_status=1
    
    # Test supporting services
    check_services || overall_status=1
    
    # Run comprehensive tests
    run_comprehensive_tests || overall_status=1
    
    # Check system resources (local only)
    check_system_resources
    
    # Generate final summary
    generate_summary $overall_status
    
    exit $overall_status
}

# Show usage if help requested
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 [environment] [base_url]"
    echo ""
    echo "Arguments:"
    echo "  environment  Target environment (local|dev|stg|prd)"
    echo "  base_url     Base URL for testing (optional, auto-detected for AWS environments)"
    echo ""
    echo "Examples:"
    echo "  $0 local                                    # Test local deployment"
    echo "  $0 dev                                      # Test dev (auto-detect URL)"
    echo "  $0 stg http://my-loadbalancer.com          # Test stg with specific URL"
    echo "  $0 prd                                      # Test production environment"
    echo ""
    exit 0
fi

# Run main verification
main "$@"