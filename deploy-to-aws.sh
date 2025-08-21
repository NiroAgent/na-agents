#!/bin/bash

# NA-Agents AWS Deployment Script
# Supports vf-dev and vf-stg environments

set -e  # Exit on any error

ENVIRONMENT=${1:-vf-dev}
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="na-agents-${ENVIRONMENT}"
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
ECR_REPOSITORY="na-agents"
IMAGE_TAG=$(git rev-parse --short HEAD || echo "latest")

echo "🚀 Deploying NA-Agents to AWS Environment: ${ENVIRONMENT}"
echo "📍 Region: ${REGION}"
echo "🏷️  Image Tag: ${IMAGE_TAG}"
echo ""

# Validate environment
if [[ ! "${ENVIRONMENT}" =~ ^(vf-dev|vf-stg)$ ]]; then
    echo "❌ Error: Environment must be 'vf-dev' or 'vf-stg'"
    exit 1
fi

# Check required tools
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed."; exit 1; }

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "❌ AWS credentials not configured properly."; exit 1; }

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 AWS Account ID: ${AWS_ACCOUNT_ID}"

# Build and push Docker image
echo ""
echo "🔨 Building Docker image..."
docker build -t na-agents:${IMAGE_TAG} .

# Login to ECR
echo "🔑 Logging into ECR..."
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}

# Create ECR repository if it doesn't exist
echo "📦 Checking ECR repository..."
aws ecr describe-repositories --repository-names ${ECR_REPOSITORY} --region ${REGION} 2>/dev/null || {
    echo "📦 Creating ECR repository..."
    aws ecr create-repository --repository-name ${ECR_REPOSITORY} --region ${REGION}
}

# Tag and push image
echo "📤 Pushing image to ECR..."
docker tag na-agents:${IMAGE_TAG} ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}
docker tag na-agents:${IMAGE_TAG} ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}
docker push ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest

echo "✅ Docker image pushed successfully"

# Deploy infrastructure
echo ""
echo "🏗️  Deploying infrastructure..."

# Create CloudFormation template
cat > cloudformation-template.yml << EOF
AWSTemplateFormatVersion: '2010-09-09'
Description: 'NA-Agents Infrastructure for ${ENVIRONMENT}'

Parameters:
  Environment:
    Type: String
    Default: ${ENVIRONMENT}
  ECRImageURI:
    Type: String
    Default: ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}

Resources:
  # VPC for agents
  AgentsVPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-vpc-\${Environment}'

  # Public subnet for load balancer
  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref AgentsVPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-public-subnet-1-\${Environment}'

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref AgentsVPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-public-subnet-2-\${Environment}'

  # Private subnets for agents
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref AgentsVPC
      CidrBlock: 10.0.10.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-private-subnet-1-\${Environment}'

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref AgentsVPC
      CidrBlock: 10.0.11.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-private-subnet-2-\${Environment}'

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-igw-\${Environment}'

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref AgentsVPC
      InternetGatewayId: !Ref InternetGateway

  # NAT Gateway for private subnets
  NATGateway:
    Type: AWS::EC2::NatGateway
    Properties:
      AllocationId: !GetAtt EIPForNAT.AllocationId
      SubnetId: !Ref PublicSubnet1

  EIPForNAT:
    Type: AWS::EC2::EIP
    DependsOn: AttachGateway
    Properties:
      Domain: vpc

  # Route tables
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref AgentsVPC
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-public-rt-\${Environment}'

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  PublicSubnetRouteTableAssociation1:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet1
      RouteTableId: !Ref PublicRouteTable

  PublicSubnetRouteTableAssociation2:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet2
      RouteTableId: !Ref PublicRouteTable

  PrivateRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref AgentsVPC
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-private-rt-\${Environment}'

  PrivateRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PrivateRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      NatGatewayId: !Ref NATGateway

  PrivateSubnetRouteTableAssociation1:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet1
      RouteTableId: !Ref PrivateRouteTable

  PrivateSubnetRouteTableAssociation2:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PrivateSubnet2
      RouteTableId: !Ref PrivateRouteTable

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub 'na-agents-\${Environment}'
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub 'na-agents-alb-\${Environment}'
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Tags:
        - Key: Environment
          Value: !Ref Environment

  # Security Groups
  ALBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for Application Load Balancer
      VpcId: !Ref AgentsVPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-alb-sg-\${Environment}'

  AgentsSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for NA-Agents
      VpcId: !Ref AgentsVPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5001
          ToPort: 5005
          SourceSecurityGroupId: !Ref ALBSecurityGroup
        - IpProtocol: tcp
          FromPort: 5001
          ToPort: 5005
          SourceSecurityGroupId: !Ref AgentsSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-sg-\${Environment}'

  # IAM Role for ECS tasks
  ECSTaskRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ecs-tasks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
      Policies:
        - PolicyName: AgentsPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - lambda:*
                  - ecs:*
                  - batch:*
                  - dynamodb:*
                  - s3:*
                  - cloudwatch:*
                  - logs:*
                Resource: '*'

  # Task Definitions for each agent
  ArchitectTaskDefinition:
    Type: AWS::ECS::TaskDefinition
    Properties:
      Family: !Sub 'architect-agent-\${Environment}'
      NetworkMode: awsvpc
      RequiresCompatibilities:
        - FARGATE
      Cpu: 512
      Memory: 1024
      ExecutionRoleArn: !Ref ECSTaskRole
      TaskRoleArn: !Ref ECSTaskRole
      ContainerDefinitions:
        - Name: architect-agent
          Image: !Ref ECRImageURI
          Command: ["node", "dist/agents/architect-agent.js"]
          PortMappings:
            - ContainerPort: 5001
              Protocol: tcp
          Environment:
            - Name: NODE_ENV
              Value: production
            - Name: DASHBOARD_URL
              Value: http://dashboard:4001
            - Name: LOG_LEVEL
              Value: info
          LogConfiguration:
            LogDriver: awslogs
            Options:
              awslogs-group: !Sub '/aws/ecs/na-agents-\${Environment}'
              awslogs-region: !Ref AWS::Region
              awslogs-stream-prefix: architect-agent
          Essential: true

  # ECS Services (one for each agent)
  ArchitectService:
    Type: AWS::ECS::Service
    DependsOn: ALBListener
    Properties:
      ServiceName: !Sub 'architect-service-\${Environment}'
      Cluster: !Ref ECSCluster
      TaskDefinition: !Ref ArchitectTaskDefinition
      DesiredCount: 1
      LaunchType: FARGATE
      NetworkConfiguration:
        AwsvpcConfiguration:
          AssignPublicIp: DISABLED
          SecurityGroups:
            - !Ref AgentsSecurityGroup
          Subnets:
            - !Ref PrivateSubnet1
            - !Ref PrivateSubnet2
      LoadBalancers:
        - ContainerName: architect-agent
          ContainerPort: 5001
          TargetGroupArn: !Ref ArchitectTargetGroup

  # Target Groups
  ArchitectTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Name: !Sub 'architect-tg-\${Environment}'
      Port: 5001
      Protocol: HTTP
      VpcId: !Ref AgentsVPC
      TargetType: ip
      HealthCheckPath: /health
      HealthCheckProtocol: HTTP
      HealthCheckIntervalSeconds: 30
      HealthCheckTimeoutSeconds: 5
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 3

  # ALB Listener
  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ArchitectTargetGroup
      LoadBalancerArn: !Ref ApplicationLoadBalancer
      Port: 80
      Protocol: HTTP

  # CloudWatch Log Group
  CloudWatchLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/ecs/na-agents-\${Environment}'
      RetentionInDays: 14

Outputs:
  LoadBalancerDNS:
    Description: DNS name of the load balancer
    Value: !GetAtt ApplicationLoadBalancer.DNSName
    Export:
      Name: !Sub '\${AWS::StackName}-LoadBalancerDNS'

  VPCId:
    Description: VPC ID
    Value: !Ref AgentsVPC
    Export:
      Name: !Sub '\${AWS::StackName}-VPCId'
EOF

# Deploy CloudFormation stack
echo "🏗️  Deploying CloudFormation stack: ${STACK_NAME}"
aws cloudformation deploy \
    --template-file cloudformation-template.yml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        Environment=${ENVIRONMENT} \
        ECRImageURI=${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION} \
    --tags \
        Environment=${ENVIRONMENT} \
        Project=na-agents \
        ManagedBy=cloudformation

# Get stack outputs
echo ""
echo "📋 Getting deployment information..."
LOAD_BALANCER_DNS=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" \
    --output text)

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Access URLs:"
echo "   Load Balancer: http://${LOAD_BALANCER_DNS}"
echo "   Architect Agent: http://${LOAD_BALANCER_DNS}/health"
echo ""
echo "🔍 Useful AWS CLI commands:"
echo "   Check services: aws ecs list-services --cluster na-agents-${ENVIRONMENT} --region ${REGION}"
echo "   View logs: aws logs tail /aws/ecs/na-agents-${ENVIRONMENT} --follow --region ${REGION}"
echo "   Update service: aws ecs update-service --cluster na-agents-${ENVIRONMENT} --service architect-service-${ENVIRONMENT} --force-new-deployment --region ${REGION}"
echo ""

# Clean up temporary files
rm -f cloudformation-template.yml

echo "🎉 Deployment complete for environment: ${ENVIRONMENT}"