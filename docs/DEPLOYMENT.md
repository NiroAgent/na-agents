# 🚀 NA-Agents Deployment Documentation

## Overview

Comprehensive deployment guide for the NA-Agents multi-agent system across development, staging, and production environments using TypeScript, Docker, and AWS infrastructure.

## Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose
- AWS CLI configured
- GitHub repository access
- Domain access (visualforge.ai)

### Automated Deployment
```bash
# 1. Push to trigger GitHub Actions
git push origin main

# 2. Monitor deployment
# https://github.com/NiroAgent/na-agents/actions

# 3. Verify deployment
curl https://dev.agents.visualforge.ai/health
```

## Environment Configuration

### Environment Structure
```
dev.agents.visualforge.ai     # Development environment
stg.agents.visualforge.ai     # Staging environment  
agents.visualforge.ai         # Production environment
```

### AWS Account Mapping
```bash
# Development
AWS_ACCOUNT_ID_DEV=319040880702
ENVIRONMENT=dev

# Staging
AWS_ACCOUNT_ID_STG=275057778147
ENVIRONMENT=stg

# Production
AWS_ACCOUNT_ID_PRD=229742714212
ENVIRONMENT=prd
```

## Agent Architecture

### Agent Ports and Services
```
Port 5001: Architect Agent   - System design and architecture
Port 5002: Developer Agent   - Code generation and implementation
Port 5003: DevOps Agent      - Deployment and infrastructure  
Port 5004: QA Agent          - Testing and quality assurance
Port 5005: Manager Agent     - Project coordination
Port 7000: Chat Interface    - WebSocket communication
Port 6000: GitHub Service    - Webhook integration
```

### Service Dependencies
```
Dashboard API: http://localhost:4001
Database: DynamoDB (AWS) / PostgreSQL (local)
Message Queue: AWS SQS / Redis (local)
File Storage: AWS S3 / Local filesystem
```

## Local Development

### Docker Compose Setup
```bash
# 1. Clone repository
git clone https://github.com/NiroAgent/na-agents.git
cd na-agents

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Start services
docker-compose up -d

# 4. Verify all agents
for port in 5001 5002 5003 5004 5005; do
  curl http://localhost:$port/health
done
```

### Manual Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Start all agents
npm start

# Alternative: Start individual agents
npm run dev:architect
npm run dev:developer
npm run dev:devops
npm run dev:qa
npm run dev:manager
```

## AWS Deployment

### GitHub Actions CI/CD

#### Required Secrets
Configure in GitHub Repository Settings → Secrets and Variables:

```bash
# Organization-level secrets
AWS_ACCESS_KEY_ID          # AWS access key
AWS_SECRET_ACCESS_KEY      # AWS secret key

# Repository variables  
AWS_ACCOUNT_ID_DEV=319040880702
AWS_ACCOUNT_ID_STG=275057778147
AWS_ACCOUNT_ID_PRD=229742714212
```

#### Deployment Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy NA-Agents
on:
  push:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - stg
          - prd

jobs:
  deploy-dev:
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    environment: dev
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Development
        run: |
          export AWS_ACCOUNT_ID=${{ vars.AWS_ACCOUNT_ID_DEV }}
          ./scripts/setup-agents-dns.sh dev
          ./scripts/setup-security.sh dev
          ./scripts/verify-deployment.sh dev
```

### Manual AWS Deployment

#### DNS Configuration
```bash
# Deploy DNS records for development
./scripts/setup-agents-dns.sh dev

# Deploy DNS records for staging
./scripts/setup-agents-dns.sh stg

# Deploy DNS records for production
./scripts/setup-agents-dns.sh prd
```

#### Security Configuration
```bash
# Setup WAF and security for development
./scripts/setup-security.sh dev

# Setup WAF and security for staging
./scripts/setup-security.sh stg

# Setup WAF and security for production
./scripts/setup-security.sh prd
```

### Infrastructure as Code

#### CloudFormation Templates
```
infrastructure/
├── agents-dns-records.yml      # DNS and Route53 configuration
├── security-configuration.yml  # WAF, API Gateway, security
└── dns-configuration.yml       # Legacy DNS configuration
```

#### DNS Records Template
```yaml
# infrastructure/agents-dns-records.yml
Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, stg, prd]
  
Conditions:
  IsProduction: !Equals [!Ref Environment, prd]

Resources:
  AgentsDNSRecord:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneId: !Ref HostedZoneId
      Name: !If
        - IsProduction
        - 'agents.visualforge.ai'
        - !Sub '${Environment}.agents.visualforge.ai'
      Type: A
      AliasTarget:
        DNSName: !GetAtt LoadBalancer.DNSName
        HostedZoneId: !GetAtt LoadBalancer.CanonicalHostedZoneID
```

## Security Configuration

### WAF Protection
```yaml
# Rate limiting rules
Development: 2000 requests per 15 minutes
Staging: 1500 requests per 15 minutes
Production: 1000 requests per 15 minutes

# Security rules
- SQL injection protection
- XSS filtering
- IP-based geographic blocking
- Known bad inputs blocking
```

### API Security
```bash
# API key configuration
API_KEY_DEV=dev-api-key-12345
API_KEY_STG=stg-api-key-67890
API_KEY_PRD=prd-api-key-abcdef

# HTTPS enforcement
HSTS: max-age=31536000; includeSubDomains
CSP: default-src 'self'; script-src 'self' 'unsafe-inline'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

### Certificate Management
```bash
# Using existing wildcard certificate
Certificate: *.visualforge.ai
Provider: AWS Certificate Manager
Validation: DNS
Auto-renewal: Enabled
```

## Service Integration

### Dashboard Integration
```bash
# Register agents with dashboard
POST /api/agents/register
{
  "id": "ai-architect-agent-1",
  "type": "architect",
  "port": 5001,
  "capabilities": ["system_design", "architecture", "documentation"],
  "status": "online",
  "version": "1.0.0"
}

# Send heartbeats
POST /api/agents/{agentId}/heartbeat
{
  "status": "running",
  "metrics": {
    "cpuUsage": 25.0,
    "memoryUsage": 45.2,
    "tasksCompleted": 142,
    "currentTasks": 3
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

### GitHub Integration
```bash
# Webhook configuration
Webhook URL: https://dev.agents.visualforge.ai:6000/github/webhook
Events: issues, pull_request, push
Secret: github-webhook-secret

# Agent assignment based on labels
architecture -> architect-agent
bug -> developer-agent  
deployment -> devops-agent
testing -> qa-agent
coordination -> manager-agent
```

## Monitoring and Observability

### Health Checks
```bash
# Basic health check
curl https://dev.agents.visualforge.ai:5001/health
# Response: {"status": "healthy", "timestamp": "2025-08-21T10:30:00Z"}

# Detailed status
curl https://dev.agents.visualforge.ai:5001/status
# Response: {"agentId": "architect-1", "metrics": {...}, "uptime": 3600}

# Queue status
curl https://dev.agents.visualforge.ai:5001/queue
# Response: {"queueSize": 3, "processing": true, "tasks": [...]}
```

### Logging
```bash
# Application logs
logs/
├── architect-agent.log
├── developer-agent.log
├── devops-agent.log
├── qa-agent.log
└── manager-agent.log

# CloudWatch logs (AWS)
Log Groups:
- /aws/lambda/na-agents-dev
- /aws/ecs/na-agents-stg
- /aws/ec2/na-agents-prd
```

### Metrics
```bash
# Custom metrics endpoint
curl https://dev.agents.visualforge.ai:5001/metrics

# Key metrics
- Request count and latency
- Error rates by endpoint
- Agent utilization
- Queue depth and processing time
- Memory and CPU usage
```

## Performance Optimization

### Resource Allocation
```yaml
# Development
CPU: 1 vCPU per agent
Memory: 512MB per agent
Storage: 10GB shared

# Staging
CPU: 2 vCPU per agent
Memory: 1GB per agent
Storage: 50GB shared

# Production
CPU: 4 vCPU per agent
Memory: 2GB per agent
Storage: 100GB shared
```

### Auto-scaling
```yaml
# ECS auto-scaling configuration
Min capacity: 1
Max capacity: 10
Target CPU utilization: 70%
Target memory utilization: 80%
Scale-out cooldown: 300s
Scale-in cooldown: 600s
```

## Disaster Recovery

### Backup Strategy
```bash
# Database backups
DynamoDB: Point-in-time recovery enabled
RDS: Daily automated backups, 7-day retention

# Configuration backups
Secrets Manager: Automatic versioning
Parameter Store: Change tracking

# Code backups
GitHub: Distributed version control
ECR: Multi-region replication
```

### Failover Procedures
```bash
# Regional failover
1. Update Route53 health checks
2. Redirect traffic to backup region
3. Scale up backup infrastructure
4. Verify service availability

# Service failover
1. Health check failure detection
2. Remove unhealthy instances from load balancer
3. Launch replacement instances
4. Verify service recovery
```

## Troubleshooting

### Common Issues

#### DNS Resolution Issues
```bash
# Check DNS propagation
nslookup dev.agents.visualforge.ai
dig dev.agents.visualforge.ai

# Force DNS refresh
sudo systemctl flush-dns  # Linux
sudo dscacheutil -flushcache  # macOS
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl s_client -connect dev.agents.visualforge.ai:443 -servername dev.agents.visualforge.ai

# Verify certificate chain
curl -vI https://dev.agents.visualforge.ai
```

#### Agent Connectivity Issues
```bash
# Check agent health
for port in 5001 5002 5003 5004 5005; do
  echo "Testing port $port:"
  curl -f https://dev.agents.visualforge.ai:$port/health || echo "FAILED"
done

# Check logs
docker logs na-agents-architect
docker logs na-agents-developer
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats
top -p $(pgrep -f "node.*agent")

# Check response times
curl -w "Time: %{time_total}s\n" -s -o /dev/null https://dev.agents.visualforge.ai:5001/health
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=na-agents:*
npm start

# Increase log level
export LOG_LEVEL=debug
docker-compose up
```

## Rollback Procedures

### GitHub Actions Rollback
```bash
# Revert to previous deployment
gh workflow run deploy.yml \
  -f environment=dev \
  -f git_ref=previous-stable-commit

# Emergency rollback
gh workflow run deploy.yml \
  -f environment=prd \
  -f force_deploy=true \
  -f git_ref=last-known-good
```

### Manual Rollback
```bash
# Rollback CloudFormation stack
aws cloudformation cancel-update-stack --stack-name na-agents-dev
aws cloudformation continue-update-rollback --stack-name na-agents-dev

# Rollback DNS changes
./scripts/setup-agents-dns.sh dev --rollback
```

## Maintenance

### Regular Maintenance Tasks
```bash
# Weekly
- Review logs for errors and warnings
- Check resource utilization
- Update dependencies (security patches)
- Verify backup integrity

# Monthly
- Performance baseline review
- Cost optimization analysis
- Security scan and updates
- Documentation updates

# Quarterly
- Disaster recovery testing
- Capacity planning review
- Architecture review
- Team knowledge transfer
```

### Monitoring Checklist
- [ ] All agents responding to health checks
- [ ] SSL certificates valid and not expiring
- [ ] DNS records pointing to correct targets
- [ ] WAF rules blocking malicious traffic
- [ ] API authentication working correctly
- [ ] Dashboard integration functional
- [ ] GitHub webhooks delivering
- [ ] Performance within acceptable limits
- [ ] Error rates below thresholds
- [ ] Backup processes completing successfully

---

*Last Updated: August 21, 2025*  
*Documentation Status: Consolidated from DEPLOYMENT_STATUS.md and DNS_AUTOMATION_GUIDE.md*