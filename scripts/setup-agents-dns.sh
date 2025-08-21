#!/bin/bash

# Agents DNS Setup Script - adds agents subdomains to existing visualforge.ai infrastructure
# Uses existing *.visualforge.ai wildcard certificate

set -e

ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-us-east-1}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 Setting up Agents DNS for existing visualforge.ai infrastructure${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Region: ${REGION}${NC}"
echo ""

# Validate environment
if [[ ! "${ENVIRONMENT}" =~ ^(dev|stg|prd)$ ]]; then
    echo -e "${RED}❌ Error: Environment must be 'dev', 'stg', or 'prd'${NC}"
    exit 1
fi

# Check required tools
command -v aws >/dev/null 2>&1 || { echo -e "${RED}❌ AWS CLI is required but not installed.${NC}"; exit 1; }

# Check AWS credentials
echo -e "${BLUE}🔐 Checking AWS credentials...${NC}"
aws sts get-caller-identity > /dev/null || { echo -e "${RED}❌ AWS credentials not configured properly.${NC}"; exit 1; }

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✅ AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"

# Define stack names
AGENTS_DNS_STACK_NAME="na-agents-dns-records-${ENVIRONMENT}"
MAIN_STACK_NAME="na-agents-${ENVIRONMENT}"

echo -e "${BLUE}🔍 Checking if main infrastructure stack exists...${NC}"
if ! aws cloudformation describe-stacks --stack-name ${MAIN_STACK_NAME} --region ${REGION} >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Main infrastructure stack '${MAIN_STACK_NAME}' not found.${NC}"
    echo -e "${YELLOW}💡 Please deploy the main infrastructure first using:${NC}"
    echo -e "${YELLOW}   ./deploy-to-aws.sh ${ENVIRONMENT}${NC}"
    exit 1
fi

# Get load balancer details from main stack
echo -e "${BLUE}🔍 Retrieving load balancer details from main stack...${NC}"
LB_DNS=$(aws cloudformation describe-stacks \
    --stack-name ${MAIN_STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" \
    --output text 2>/dev/null || echo "")

LB_HOSTED_ZONE_ID=$(aws cloudformation describe-stacks \
    --stack-name ${MAIN_STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerHostedZoneId'].OutputValue" \
    --output text 2>/dev/null || echo "")

if [ -z "$LB_DNS" ] || [ -z "$LB_HOSTED_ZONE_ID" ]; then
    echo -e "${RED}❌ Could not retrieve load balancer details from main stack${NC}"
    echo -e "${YELLOW}💡 Ensure your main stack exports 'LoadBalancerDNS' and 'LoadBalancerHostedZoneId'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Load Balancer DNS: ${LB_DNS}${NC}"
echo -e "${GREEN}✅ Load Balancer Hosted Zone ID: ${LB_HOSTED_ZONE_ID}${NC}"

# Check if visualforge.ai hosted zone exists
echo -e "${BLUE}🔍 Checking if hosted zone for visualforge.ai exists...${NC}"
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
    --dns-name visualforge.ai \
    --query "HostedZones[?Name=='visualforge.ai.'].Id" \
    --output text 2>/dev/null | sed 's|/hostedzone/||' || echo "")

if [ -z "$HOSTED_ZONE_ID" ]; then
    echo -e "${RED}❌ Hosted zone for visualforge.ai does not exist${NC}"
    echo -e "${YELLOW}💡 Please ensure visualforge.ai DNS is configured first${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found hosted zone for visualforge.ai: ${HOSTED_ZONE_ID}${NC}"

# Check if agents DNS stack already exists
echo -e "${BLUE}🔍 Checking if agents DNS stack already exists...${NC}"
if aws cloudformation describe-stacks --stack-name ${AGENTS_DNS_STACK_NAME} --region ${REGION} >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Agents DNS stack '${AGENTS_DNS_STACK_NAME}' already exists. Updating...${NC}"
    STACK_OPERATION="update-stack"
else
    echo -e "${GREEN}✅ Creating new agents DNS stack '${AGENTS_DNS_STACK_NAME}'${NC}"
    STACK_OPERATION="create-stack"
fi

# Deploy agents DNS records
echo -e "${BLUE}🚀 Deploying agents DNS records...${NC}"
aws cloudformation ${STACK_OPERATION} \
    --stack-name ${AGENTS_DNS_STACK_NAME} \
    --template-body file://infrastructure/agents-dns-records.yml \
    --parameters \
        ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
        ParameterKey=LoadBalancerDNS,ParameterValue=${LB_DNS} \
        ParameterKey=LoadBalancerHostedZoneId,ParameterValue=${LB_HOSTED_ZONE_ID} \
    --region ${REGION} \
    --tags \
        Key=Environment,Value=${ENVIRONMENT} \
        Key=Project,Value=NA-Agents \
        Key=ManagedBy,Value=script

# Wait for stack operation to complete
echo -e "${BLUE}⏳ Waiting for agents DNS stack operation to complete...${NC}"
if [ "$STACK_OPERATION" = "create-stack" ]; then
    aws cloudformation wait stack-create-complete --stack-name ${AGENTS_DNS_STACK_NAME} --region ${REGION}
else
    aws cloudformation wait stack-update-complete --stack-name ${AGENTS_DNS_STACK_NAME} --region ${REGION}
fi

# Get outputs
echo -e "${BLUE}📋 Retrieving agents DNS configuration outputs...${NC}"
AGENTS_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name ${AGENTS_DNS_STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='AgentsDomainName'].OutputValue" \
    --output text)

echo ""
echo -e "${GREEN}✅ Agents DNS Configuration Complete!${NC}"
echo -e "${GREEN}🌐 Agents Domain: ${AGENTS_DOMAIN}${NC}"
echo -e "${GREEN}🔒 Using existing wildcard certificate: *.visualforge.ai${NC}"
echo ""

# Test DNS resolution
echo -e "${BLUE}🔍 Testing DNS resolution...${NC}"
if ping -c 1 ${AGENTS_DOMAIN} >/dev/null 2>&1; then
    echo -e "${GREEN}✅ DNS resolution successful for ${AGENTS_DOMAIN}${NC}"
else
    echo -e "${YELLOW}⚠️ DNS resolution may take up to 5 minutes to propagate${NC}"
    echo -e "${YELLOW}💡 Test with: ping ${AGENTS_DOMAIN}${NC}"
fi

# Provide next steps
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo -e "${BLUE}1. Wait for DNS propagation (up to 5 minutes)${NC}"
echo -e "${BLUE}2. Test the deployment:${NC}"
echo -e "${BLUE}   curl https://${AGENTS_DOMAIN}/health${NC}"
echo -e "${BLUE}3. Run regression tests:${NC}"
echo -e "${BLUE}   npm run test:regression:${ENVIRONMENT}${NC}"
echo ""

# Save configuration for later use
cat > agents-dns-config-${ENVIRONMENT}.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "agentsDomain": "${AGENTS_DOMAIN}",
  "loadBalancerDNS": "${LB_DNS}",
  "hostedZoneId": "${HOSTED_ZONE_ID}",
  "stackName": "${AGENTS_DNS_STACK_NAME}",
  "region": "${REGION}",
  "awsAccountId": "${AWS_ACCOUNT_ID}",
  "useExistingCert": true,
  "certDomain": "*.visualforge.ai"
}
EOF

echo -e "${GREEN}✅ Configuration saved to agents-dns-config-${ENVIRONMENT}.json${NC}"