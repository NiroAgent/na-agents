# 🌐 DNS Automation Guide for NA-Agents

**Complete automation for agents subdomain configuration across all environments**

## 📋 **Overview**

The NA-Agents system uses automated DNS configuration to set up secure subdomain isolation:

```
agents.dev.visualforge.ai     # Development environment
agents.stg.visualforge.ai     # Staging environment  
agents.visualforge.ai         # Production environment
```

## 🏗️ **Architecture**

### **Security Benefits**
- **🔒 Domain Isolation**: Agents API completely separate from main platform
- **🛡️ Independent Security**: Separate SSL certificates, firewall rules, rate limiting
- **⚡ Service Separation**: Independent scaling and deployment
- **🎯 Clean API Management**: Easier CORS, authentication, access control

### **Infrastructure Components**
- **Route53 Hosted Zone**: DNS management for visualforge.ai
- **A Records**: Alias records pointing to load balancers
- **SSL Certificates**: Auto-provisioned ACM certificates with DNS validation
- **Health Checks**: Route53 health monitoring for production
- **Wildcard Support**: `*.agents.*` for individual agent services

## 🚀 **Automated Deployment**

### **1. Integrated CI/CD Pipeline**

DNS configuration is **automatically deployed** with every environment deployment:

```yaml
# Runs automatically in GitHub Actions
./deploy-to-aws.sh dev              # Deploy main infrastructure
./scripts/setup-dns.sh dev          # Configure DNS automatically
```

**Triggered by:**
- Push to `main` branch → deploys to dev
- Manual deployment to staging/production
- Release workflow

### **2. Manual DNS Setup**

For standalone DNS configuration or troubleshooting:

```bash
# Setup development environment DNS
./scripts/setup-dns.sh dev visualforge.ai false

# Setup staging environment DNS  
./scripts/setup-dns.sh stg visualforge.ai false

# Setup production DNS (first time with hosted zone creation)
./scripts/setup-dns.sh prd visualforge.ai true
```

### **3. GitHub Actions Workflow**

Manual DNS setup via GitHub Actions:

1. Go to **Actions** tab → **Setup DNS Infrastructure**
2. Click **Run workflow**
3. Select environment (dev/stg/prd)
4. Enter domain name (visualforge.ai)
5. Choose whether to create hosted zone (first time only)

## 📁 **Files Structure**

```
na-agents/
├── infrastructure/
│   └── dns-configuration.yml        # CloudFormation template
├── scripts/
│   └── setup-dns.sh                # DNS deployment script
├── .github/workflows/
│   ├── deploy.yml                  # Main deployment (includes DNS)
│   └── setup-dns.yml               # Standalone DNS workflow
└── DNS_AUTOMATION_GUIDE.md         # This documentation
```

## ⚙️ **Configuration Details**

### **CloudFormation Template** (`infrastructure/dns-configuration.yml`)

**Resources Created:**
- **Route53 Records**: A records with load balancer aliases
- **SSL Certificates**: ACM certificates with DNS validation
- **Health Checks**: Route53 health monitoring (production only)
- **Wildcard Support**: `*.agents.*` for individual services

**Parameters:**
- `Environment`: dev, stg, prd
- `DomainName`: Base domain (visualforge.ai)
- `LoadBalancerDNS`: From main infrastructure stack
- `CreateHostedZone`: Whether to create hosted zone

### **Deployment Script** (`scripts/setup-dns.sh`)

**Features:**
- ✅ **Dependency Checking**: Verifies main infrastructure exists
- ✅ **Load Balancer Discovery**: Auto-retrieves LB details from main stack
- ✅ **Hosted Zone Detection**: Checks if hosted zone exists
- ✅ **DNS Validation**: Tests resolution after deployment
- ✅ **Configuration Export**: Saves settings to JSON file

**Usage:**
```bash
./scripts/setup-dns.sh <environment> <domain> [create_hosted_zone]
```

## 🔧 **Environment Configuration**

### **Development (dev)**
```bash
# Domain: agents.dev.visualforge.ai
# AWS Account: 319040880702 (DEV)
# Auto-deploy: ✅ On push to main
# SSL: Auto-provisioned ACM certificate
# Health Check: ❌ Not enabled
```

### **Staging (stg)**
```bash
# Domain: agents.stg.visualforge.ai  
# AWS Account: 275057778147 (STG)
# Auto-deploy: ✅ Manual approval
# SSL: Auto-provisioned ACM certificate
# Health Check: ❌ Not enabled
```

### **Production (prd)**
```bash
# Domain: agents.visualforge.ai
# AWS Account: 229742714212 (PRD)
# Auto-deploy: ✅ Manual trigger only
# SSL: Auto-provisioned ACM certificate
# Health Check: ✅ Route53 health monitoring
```

## 📊 **DNS Records Created**

### **Main Alias Record**
```
agents.dev.visualforge.ai   → dev-load-balancer.elb.amazonaws.com
agents.stg.visualforge.ai   → stg-load-balancer.elb.amazonaws.com  
agents.visualforge.ai       → prd-load-balancer.elb.amazonaws.com
```

### **Wildcard Record** (for individual agents)
```
*.agents.dev.visualforge.ai  → dev-load-balancer.elb.amazonaws.com
*.agents.stg.visualforge.ai  → stg-load-balancer.elb.amazonaws.com
*.agents.visualforge.ai      → prd-load-balancer.elb.amazonaws.com
```

This enables:
- `architect.agents.dev.visualforge.ai:5001`
- `developer.agents.dev.visualforge.ai:5002`
- etc.

## 🧪 **Testing DNS Configuration**

### **Automated Testing**
```bash
# Environment-specific regression tests
npm run test:regression:dev   # Tests agents.dev.visualforge.ai
npm run test:regression:stg   # Tests agents.stg.visualforge.ai  
npm run test:regression:prd   # Tests agents.visualforge.ai
```

### **Manual Testing**
```bash
# Test DNS resolution
nslookup agents.dev.visualforge.ai

# Test HTTPS connectivity
curl https://agents.dev.visualforge.ai/health

# Test individual agent
curl https://agents.dev.visualforge.ai:5001/health

# Test with wildcard (if supported by load balancer)
curl https://architect.agents.dev.visualforge.ai/health
```

## 🔍 **Troubleshooting**

### **DNS Not Resolving**
```bash
# 1. Check if hosted zone exists
aws route53 list-hosted-zones-by-name --dns-name visualforge.ai

# 2. Check DNS records
aws route53 list-resource-record-sets --hosted-zone-id Z1234567890

# 3. Wait for propagation (up to 10 minutes)
nslookup agents.dev.visualforge.ai

# 4. Check CloudFormation stack
aws cloudformation describe-stacks --stack-name na-agents-dns-dev
```

### **SSL Certificate Issues**
```bash
# 1. Check certificate status
aws acm list-certificates --region us-east-1

# 2. Check DNS validation records
aws route53 list-resource-record-sets --hosted-zone-id Z1234567890 | grep CNAME

# 3. Wait for certificate validation (up to 30 minutes)
```

### **Load Balancer Not Found**
```bash
# 1. Verify main infrastructure is deployed
aws cloudformation describe-stacks --stack-name na-agents-dev

# 2. Check load balancer outputs
aws cloudformation describe-stacks --stack-name na-agents-dev \
  --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue"
```

## 🚨 **Important Notes**

### **First Time Setup**
1. **Hosted Zone**: Only create once per domain (`create_hosted_zone=true`)
2. **DNS Propagation**: Can take 5-10 minutes to resolve globally
3. **SSL Validation**: ACM certificates can take 30+ minutes to validate
4. **Dependencies**: Main infrastructure must be deployed first

### **Cross-Account Considerations**
- Each environment uses different AWS accounts
- DNS records are created in the shared hosted zone
- SSL certificates are environment-specific
- Load balancers are account-specific

### **Cost Considerations**
- **Route53 Hosted Zone**: $0.50/month
- **Route53 Queries**: $0.40 per million queries
- **ACM Certificates**: Free
- **Health Checks**: $0.50/month each (production only)

## 📋 **Quick Reference**

### **Common Commands**
```bash
# Deploy DNS for all environments
./scripts/setup-dns.sh dev visualforge.ai false
./scripts/setup-dns.sh stg visualforge.ai false  
./scripts/setup-dns.sh prd visualforge.ai false

# Test all environments
npm run test:regression:dev
npm run test:regression:stg
npm run test:regression:prd

# Check DNS status
nslookup agents.dev.visualforge.ai
nslookup agents.stg.visualforge.ai
nslookup agents.visualforge.ai
```

### **Generated Files**
- `dns-config-dev.json` - Development environment configuration
- `dns-config-stg.json` - Staging environment configuration  
- `dns-config-prd.json` - Production environment configuration

---

## ✅ **DNS Automation Complete**

The NA-Agents system now has **fully automated DNS configuration** that:

- 🔒 **Provides security isolation** between main platform and agents
- 🚀 **Deploys automatically** with every environment deployment
- 🌐 **Manages SSL certificates** with automatic DNS validation
- 📊 **Includes health monitoring** for production environments
- 🧪 **Supports comprehensive testing** across all environments

**Result: Production-ready DNS automation with secure subdomain isolation for all NA-Agents environments.**