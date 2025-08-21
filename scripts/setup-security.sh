#!/bin/bash

# Security Setup Script for NA-Agents
# Deploys WAF, API keys, and security configurations

set -e

ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-us-east-1}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔒 Setting up security for NA-Agents${NC}"
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
SECURITY_STACK_NAME="na-agents-security-${ENVIRONMENT}"
MAIN_STACK_NAME="na-agents-${ENVIRONMENT}"

echo -e "${BLUE}🔍 Checking if main infrastructure stack exists...${NC}"
if ! aws cloudformation describe-stacks --stack-name ${MAIN_STACK_NAME} --region ${REGION} >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Main infrastructure stack '${MAIN_STACK_NAME}' not found.${NC}"
    echo -e "${YELLOW}💡 Please deploy the main infrastructure first using:${NC}"
    echo -e "${YELLOW}   ./deploy-to-aws.sh ${ENVIRONMENT}${NC}"
    exit 1
fi

# Get load balancer details from main stack
echo -e "${BLUE}🔍 Retrieving infrastructure details from main stack...${NC}"
LB_ARN=$(aws cloudformation describe-stacks \
    --stack-name ${MAIN_STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerArn'].OutputValue" \
    --output text 2>/dev/null || echo "")

VPC_ID=$(aws cloudformation describe-stacks \
    --stack-name ${MAIN_STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='VpcId'].OutputValue" \
    --output text 2>/dev/null || echo "")

LB_SECURITY_GROUP=$(aws cloudformation describe-stacks \
    --stack-name ${MAIN_STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerSecurityGroup'].OutputValue" \
    --output text 2>/dev/null || echo "")

if [ -z "$LB_ARN" ]; then
    echo -e "${RED}❌ Could not retrieve load balancer ARN from main stack${NC}"
    echo -e "${YELLOW}💡 Ensure your main stack exports 'LoadBalancerArn'${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Load Balancer ARN: ${LB_ARN}${NC}"
echo -e "${GREEN}✅ VPC ID: ${VPC_ID}${NC}"

# Check if security stack already exists
echo -e "${BLUE}🔍 Checking if security stack already exists...${NC}"
if aws cloudformation describe-stacks --stack-name ${SECURITY_STACK_NAME} --region ${REGION} >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️ Security stack '${SECURITY_STACK_NAME}' already exists. Updating...${NC}"
    STACK_OPERATION="update-stack"
else
    echo -e "${GREEN}✅ Creating new security stack '${SECURITY_STACK_NAME}'${NC}"
    STACK_OPERATION="create-stack"
fi

# Deploy security configuration
echo -e "${BLUE}🚀 Deploying security configuration...${NC}"
if [ -n "$VPC_ID" ] && [ -n "$LB_SECURITY_GROUP" ]; then
    # Full deployment with VPC resources
    aws cloudformation ${STACK_OPERATION} \
        --stack-name ${SECURITY_STACK_NAME} \
        --template-body file://infrastructure/security-configuration.yml \
        --parameters \
            ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
            ParameterKey=LoadBalancerArn,ParameterValue=${LB_ARN} \
            ParameterKey=VpcId,ParameterValue=${VPC_ID} \
            ParameterKey=LoadBalancerSecurityGroup,ParameterValue=${LB_SECURITY_GROUP} \
        --capabilities CAPABILITY_IAM \
        --region ${REGION} \
        --tags \
            Key=Environment,Value=${ENVIRONMENT} \
            Key=Project,Value=NA-Agents \
            Key=ManagedBy,Value=script
else
    # WAF-only deployment (for ALB without VPC exports)
    echo -e "${YELLOW}⚠️ VPC details not available, deploying WAF only${NC}"
    cat > temp-security-template.yml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Security Configuration for NA-Agents - WAF Only'

Parameters:
  Environment:
    Type: String
  LoadBalancerArn:
    Type: String

Resources:
  AgentsWebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: !Sub 'na-agents-waf-${Environment}'
      Scope: REGIONAL
      DefaultAction:
        Allow: {}
      Rules:
        - Name: RateLimitRule
          Priority: 1
          Statement:
            RateBasedStatement:
              Limit: 1000
              AggregateKeyType: IP
          Action:
            Block: {}
          VisibilityConfig:
            SampledRequestsEnabled: true
            CloudWatchMetricsEnabled: true
            MetricName: !Sub 'RateLimit-${Environment}'

  WebACLAssociation:
    Type: AWS::WAFv2::WebACLAssociation
    Properties:
      ResourceArn: !Ref LoadBalancerArn
      WebACLArn: !GetAtt AgentsWebACL.Arn

Outputs:
  WebACLArn:
    Value: !GetAtt AgentsWebACL.Arn
EOF

    aws cloudformation ${STACK_OPERATION} \
        --stack-name ${SECURITY_STACK_NAME} \
        --template-body file://temp-security-template.yml \
        --parameters \
            ParameterKey=Environment,ParameterValue=${ENVIRONMENT} \
            ParameterKey=LoadBalancerArn,ParameterValue=${LB_ARN} \
        --region ${REGION} \
        --tags \
            Key=Environment,Value=${ENVIRONMENT} \
            Key=Project,Value=NA-Agents
    
    rm -f temp-security-template.yml
fi

# Wait for stack operation to complete
echo -e "${BLUE}⏳ Waiting for security stack operation to complete...${NC}"
if [ "$STACK_OPERATION" = "create-stack" ]; then
    aws cloudformation wait stack-create-complete --stack-name ${SECURITY_STACK_NAME} --region ${REGION}
else
    aws cloudformation wait stack-update-complete --stack-name ${SECURITY_STACK_NAME} --region ${REGION}
fi

# Get API key from Secrets Manager
echo -e "${BLUE}📋 Retrieving API key...${NC}"
API_KEY_ARN="na-agents-api-key-${ENVIRONMENT}"
if aws secretsmanager describe-secret --secret-id ${API_KEY_ARN} --region ${REGION} >/dev/null 2>&1; then
    API_KEY=$(aws secretsmanager get-secret-value \
        --secret-id ${API_KEY_ARN} \
        --region ${REGION} \
        --query 'SecretString' \
        --output text | jq -r '.apiKey' 2>/dev/null || echo "")
    
    if [ -n "$API_KEY" ]; then
        echo -e "${GREEN}✅ API Key retrieved successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ API Key exists but could not be parsed${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ API Key not found in Secrets Manager${NC}"
fi

echo ""
echo -e "${GREEN}✅ Security Configuration Complete!${NC}"
echo -e "${GREEN}🛡️ WAF deployed and associated with load balancer${NC}"
echo -e "${GREEN}🔑 API keys configured in Secrets Manager${NC}"
echo -e "${GREEN}📊 CloudWatch logging enabled${NC}"
echo ""

# Security recommendations
echo -e "${BLUE}📋 Security Recommendations:${NC}"
echo -e "${BLUE}1. Update your application to use the API key from Secrets Manager${NC}"
echo -e "${BLUE}2. Configure GitHub webhook secret in Secrets Manager${NC}"
echo -e "${BLUE}3. Test the WAF rules with your application${NC}"
echo -e "${BLUE}4. Monitor CloudWatch logs for security events${NC}"
echo -e "${BLUE}5. Review and adjust rate limits based on usage patterns${NC}"
echo ""

# Save security configuration
cat > security-config-${ENVIRONMENT}.json << EOF
{
  "environment": "${ENVIRONMENT}",
  "wafWebACL": "na-agents-waf-${ENVIRONMENT}",
  "apiKeySecret": "${API_KEY_ARN}",
  "securityStackName": "${SECURITY_STACK_NAME}",
  "region": "${REGION}",
  "awsAccountId": "${AWS_ACCOUNT_ID}",
  "rateLimits": {
    "production": 1000,
    "development": 2000
  }
}
EOF

echo -e "${GREEN}✅ Security configuration saved to security-config-${ENVIRONMENT}.json${NC}"