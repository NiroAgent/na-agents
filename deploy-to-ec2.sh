#!/bin/bash

# NA-Agents EC2 Deployment Script
# Deploys TypeScript agents directly on EC2 instances

set -e

ENVIRONMENT=${1:-dev}
REGION=${AWS_REGION:-us-east-1}
STACK_NAME="na-agents-ec2-${ENVIRONMENT}"
KEY_NAME=${2:-na-agents-key}
INSTANCE_TYPE=${3:-t3.medium}

echo "🚀 Deploying NA-Agents to EC2 Instances"
echo "📍 Environment: ${ENVIRONMENT}"
echo "📍 Region: ${REGION}"
echo "📍 Instance Type: ${INSTANCE_TYPE}"
echo ""

# Validate environment
if [[ ! "${ENVIRONMENT}" =~ ^(dev|stg|prd)$ ]]; then
    echo "❌ Error: Environment must be 'dev', 'stg', or 'prd'"
    exit 1
fi

# Check AWS credentials
echo "🔐 Checking AWS credentials..."
aws sts get-caller-identity > /dev/null || { echo "❌ AWS credentials not configured properly."; exit 1; }

# Get AWS Account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "📋 AWS Account ID: ${AWS_ACCOUNT_ID}"

# Get latest Amazon Linux 2023 AMI
echo "🔍 Finding latest Amazon Linux 2023 AMI..."
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters \
        "Name=name,Values=al2023-ami-*-x86_64" \
        "Name=state,Values=available" \
    --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
    --output text \
    --region ${REGION})

echo "📦 Using AMI: ${AMI_ID}"

# Create key pair if it doesn't exist
echo "🔑 Checking SSH key pair..."
if ! aws ec2 describe-key-pairs --key-names ${KEY_NAME} --region ${REGION} >/dev/null 2>&1; then
    echo "Creating new key pair: ${KEY_NAME}"
    aws ec2 create-key-pair --key-name ${KEY_NAME} --region ${REGION} \
        --query 'KeyMaterial' --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
    echo "✅ Key pair created and saved to ${KEY_NAME}.pem"
else
    echo "✅ Key pair ${KEY_NAME} already exists"
fi

# Create CloudFormation template for EC2 deployment
cat > ec2-cloudformation-template.yml << 'EOF'
AWSTemplateFormatVersion: '2010-09-09'
Description: 'NA-Agents EC2 Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues: [dev, stg, prd]
  
  InstanceType:
    Type: String
    Default: t3.medium
    Description: EC2 instance type for agents
  
  KeyName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: SSH key pair for EC2 access
  
  AMIId:
    Type: AWS::EC2::Image::Id
    Description: AMI ID for EC2 instances

Resources:
  # VPC Configuration
  AgentsVPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-vpc-${Environment}'

  # Public Subnet
  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref AgentsVPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-public-subnet-${Environment}'

  # Internet Gateway
  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-igw-${Environment}'

  AttachGateway:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref AgentsVPC
      InternetGatewayId: !Ref InternetGateway

  # Route Table
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref AgentsVPC
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-public-rt-${Environment}'

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: AttachGateway
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  SubnetRouteTableAssociation:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet
      RouteTableId: !Ref PublicRouteTable

  # Security Group for Agents
  AgentsSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for NA-Agents EC2 instances
      VpcId: !Ref AgentsVPC
      SecurityGroupIngress:
        # SSH access
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 0.0.0.0/0
        # Agent ports
        - IpProtocol: tcp
          FromPort: 5001
          ToPort: 5005
          CidrIp: 0.0.0.0/0
        # Chat interface
        - IpProtocol: tcp
          FromPort: 7000
          ToPort: 7000
          CidrIp: 0.0.0.0/0
        # GitHub service
        - IpProtocol: tcp
          FromPort: 6000
          ToPort: 6000
          CidrIp: 0.0.0.0/0
        # Dashboard communication
        - IpProtocol: tcp
          FromPort: 4001
          ToPort: 4002
          CidrIp: 0.0.0.0/0
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-sg-${Environment}'

  # IAM Role for EC2 instances
  EC2Role:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
        - arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy
      Policies:
        - PolicyName: AgentsPolicy
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - ecr:GetAuthorizationToken
                  - ecr:BatchCheckLayerAvailability
                  - ecr:GetDownloadUrlForLayer
                  - ecr:BatchGetImage
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                  - s3:GetObject
                  - s3:PutObject
                  - dynamodb:*
                  - secretsmanager:GetSecretValue
                Resource: '*'

  EC2InstanceProfile:
    Type: AWS::IAM::InstanceProfile
    Properties:
      Roles:
        - !Ref EC2Role

  # EC2 Instance for All Agents
  AgentsEC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: !Ref AMIId
      InstanceType: !Ref InstanceType
      KeyName: !Ref KeyName
      IamInstanceProfile: !Ref EC2InstanceProfile
      SubnetId: !Ref PublicSubnet
      SecurityGroupIds:
        - !Ref AgentsSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-${Environment}'
        - Key: Environment
          Value: !Ref Environment
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash
          set -e
          
          # Update system
          yum update -y
          
          # Install required packages
          yum install -y git docker nodejs npm python3 python3-pip tmux htop
          
          # Install Node.js 18
          curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
          yum install -y nodejs
          
          # Install PM2 for process management
          npm install -g pm2 typescript ts-node
          
          # Start Docker
          systemctl start docker
          systemctl enable docker
          usermod -a -G docker ec2-user
          
          # Create agent directory
          mkdir -p /opt/na-agents
          cd /opt/na-agents
          
          # Clone repository
          git clone https://github.com/NiroAgent/na-agents.git .
          
          # Install dependencies
          npm ci
          
          # Build TypeScript
          npm run build
          
          # Create environment file
          cat > .env << 'ENVEOF'
          NODE_ENV=production
          ENVIRONMENT=${Environment}
          DASHBOARD_URL=http://dashboard.visualforge.ai:4001
          AWS_REGION=${AWS::Region}
          AWS_DEFAULT_REGION=${AWS::Region}
          LOG_LEVEL=info
          ENVEOF
          
          # Create PM2 ecosystem file
          cat > ecosystem.config.js << 'PMEOF'
          module.exports = {
            apps: [
              {
                name: 'architect-agent',
                script: 'dist/agents/architect-agent.js',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                  PORT: 5001,
                  AGENT_TYPE: 'architect'
                }
              },
              {
                name: 'developer-agent',
                script: 'dist/agents/developer-agent.js',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                  PORT: 5002,
                  AGENT_TYPE: 'developer'
                }
              },
              {
                name: 'devops-agent',
                script: 'dist/agents/devops-agent.js',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                  PORT: 5003,
                  AGENT_TYPE: 'devops'
                }
              },
              {
                name: 'qa-agent',
                script: 'dist/agents/qa-agent.js',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                  PORT: 5004,
                  AGENT_TYPE: 'qa'
                }
              },
              {
                name: 'manager-agent',
                script: 'dist/agents/manager-agent.js',
                instances: 1,
                autorestart: true,
                watch: false,
                max_memory_restart: '1G',
                env: {
                  PORT: 5005,
                  AGENT_TYPE: 'manager'
                }
              }
            ]
          };
          PMEOF
          
          # Start all agents with PM2
          pm2 start ecosystem.config.js
          pm2 save
          pm2 startup systemd -u ec2-user --hp /home/ec2-user
          
          # Set up CloudWatch logs
          cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'CWEOF'
          {
            "logs": {
              "logs_collected": {
                "files": {
                  "collect_list": [
                    {
                      "file_path": "/home/ec2-user/.pm2/logs/*.log",
                      "log_group_name": "/aws/ec2/na-agents/${Environment}",
                      "log_stream_name": "{instance_id}/pm2"
                    }
                  ]
                }
              }
            }
          }
          CWEOF
          
          # Start CloudWatch agent
          /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
            -a fetch-config \
            -m ec2 \
            -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
          
          # Create health check script
          cat > /opt/na-agents/health-check.sh << 'HEALTH'
          #!/bin/bash
          echo "Checking agent health..."
          for port in 5001 5002 5003 5004 5005; do
            if curl -f http://localhost:$port/health > /dev/null 2>&1; then
              echo "Port $port: OK"
            else
              echo "Port $port: FAILED"
              pm2 restart all
            fi
          done
          HEALTH
          
          chmod +x /opt/na-agents/health-check.sh
          
          # Add health check to cron
          echo "*/5 * * * * /opt/na-agents/health-check.sh" | crontab -u ec2-user -
          
          echo "✅ NA-Agents deployment complete!"

  # Elastic IP for stable access
  AgentsEIP:
    Type: AWS::EC2::EIP
    Properties:
      Domain: vpc
      Tags:
        - Key: Name
          Value: !Sub 'na-agents-eip-${Environment}'

  EIPAssociation:
    Type: AWS::EC2::EIPAssociation
    Properties:
      InstanceId: !Ref AgentsEC2Instance
      EIP: !Ref AgentsEIP

Outputs:
  InstanceId:
    Description: EC2 Instance ID
    Value: !Ref AgentsEC2Instance
    Export:
      Name: !Sub '${AWS::StackName}-InstanceId'
  
  PublicIP:
    Description: Public IP address of the EC2 instance
    Value: !Ref AgentsEIP
    Export:
      Name: !Sub '${AWS::StackName}-PublicIP'
  
  PublicDNS:
    Description: Public DNS of the EC2 instance
    Value: !GetAtt AgentsEC2Instance.PublicDnsName
    Export:
      Name: !Sub '${AWS::StackName}-PublicDNS'
  
  SSHCommand:
    Description: SSH command to connect to the instance
    Value: !Sub 'ssh -i ${KeyName}.pem ec2-user@${AgentsEIP}'
  
  AgentURLs:
    Description: Agent endpoint URLs
    Value: !Sub |
      Architect: http://${AgentsEIP}:5001
      Developer: http://${AgentsEIP}:5002
      DevOps: http://${AgentsEIP}:5003
      QA: http://${AgentsEIP}:5004
      Manager: http://${AgentsEIP}:5005
EOF

# Deploy CloudFormation stack
echo "🏗️ Deploying CloudFormation stack: ${STACK_NAME}"
aws cloudformation deploy \
    --template-file ec2-cloudformation-template.yml \
    --stack-name ${STACK_NAME} \
    --parameter-overrides \
        Environment=${ENVIRONMENT} \
        InstanceType=${INSTANCE_TYPE} \
        KeyName=${KEY_NAME} \
        AMIId=${AMI_ID} \
    --capabilities CAPABILITY_IAM \
    --region ${REGION} \
    --tags \
        Environment=${ENVIRONMENT} \
        Project=na-agents \
        ManagedBy=cloudformation

# Get stack outputs
echo ""
echo "📋 Getting deployment information..."
INSTANCE_ID=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" \
    --output text)

PUBLIC_IP=$(aws cloudformation describe-stacks \
    --stack-name ${STACK_NAME} \
    --region ${REGION} \
    --query "Stacks[0].Outputs[?OutputKey=='PublicIP'].OutputValue" \
    --output text)

echo ""
echo "✅ EC2 Deployment completed successfully!"
echo ""
echo "🖥️ Instance Information:"
echo "   Instance ID: ${INSTANCE_ID}"
echo "   Public IP: ${PUBLIC_IP}"
echo ""
echo "🌐 Agent Access URLs:"
echo "   Architect Agent: http://${PUBLIC_IP}:5001"
echo "   Developer Agent: http://${PUBLIC_IP}:5002"
echo "   DevOps Agent: http://${PUBLIC_IP}:5003"
echo "   QA Agent: http://${PUBLIC_IP}:5004"
echo "   Manager Agent: http://${PUBLIC_IP}:5005"
echo ""
echo "🔑 SSH Access:"
echo "   ssh -i ${KEY_NAME}.pem ec2-user@${PUBLIC_IP}"
echo ""
echo "📊 Monitoring:"
echo "   PM2 Status: ssh -i ${KEY_NAME}.pem ec2-user@${PUBLIC_IP} 'pm2 status'"
echo "   Logs: ssh -i ${KEY_NAME}.pem ec2-user@${PUBLIC_IP} 'pm2 logs'"
echo ""
echo "⏳ Note: Agents may take 2-3 minutes to fully start after instance launch"

# Wait for instance to be ready
echo ""
echo "⏳ Waiting for instance to be ready..."
aws ec2 wait instance-status-ok --instance-ids ${INSTANCE_ID} --region ${REGION}

# Test agent connectivity
echo ""
echo "🧪 Testing agent connectivity..."
sleep 60  # Give agents time to start

for port in 5001 5002 5003 5004 5005; do
    agent_name=$(case $port in
        5001) echo "Architect";;
        5002) echo "Developer";;
        5003) echo "DevOps";;
        5004) echo "QA";;
        5005) echo "Manager";;
    esac)
    
    echo -n "  Testing ${agent_name} agent (port ${port}): "
    if curl -f -s --connect-timeout 5 http://${PUBLIC_IP}:${port}/health > /dev/null; then
        echo "✅ Online"
    else
        echo "⏳ Starting..."
    fi
done

# Clean up temporary files
rm -f ec2-cloudformation-template.yml

echo ""
echo "🎉 Deployment complete! Agents are running on EC2 instance: ${PUBLIC_IP}"