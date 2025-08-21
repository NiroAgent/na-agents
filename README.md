# 🤖 NA-Agents: Multi-Agent AI Development System

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![AWS](https://img.shields.io/badge/AWS-Deployed-orange.svg)](https://aws.amazon.com/)
[![Security](https://img.shields.io/badge/Security-WAF%20%2B%20API%20Keys-red.svg)](https://aws.amazon.com/waf/)

A sophisticated multi-agent AI system designed for collaborative software development, built with TypeScript and deployed on secure AWS infrastructure.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker and Docker Compose (optional)
- AWS CLI (for cloud deployment)
- GitHub access (for webhook integration)

### Local Development
```bash
# Clone repository
git clone https://github.com/NiroAgent/na-agents.git
cd na-agents

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Build TypeScript
npm run build

# Start all agents
npm start
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d

# Verify all agents are running
for port in 5001 5002 5003 5004 5005; do
  curl http://localhost:$port/health
done
```

### Production Deployment
```bash
# Deploy via GitHub Actions (automatic)
git push origin main

# Manual deployment
./scripts/deploy.sh dev  # Development
./scripts/deploy.sh stg  # Staging
./scripts/deploy.sh prd  # Production
```

## 🏗️ System Architecture

### Agent Orchestra
```
🏗️ Architect Agent (5001)  ──── System design and architecture
👨‍💻 Developer Agent (5002)  ──── Code generation and implementation
🚀 DevOps Agent (5003)     ──── Deployment and infrastructure
🧪 QA Agent (5004)         ──── Testing and quality assurance
📊 Manager Agent (5005)    ──── Project coordination
💬 Chat Interface (7000)   ──── WebSocket communication
🔗 GitHub Service (6000)   ──── Webhook integration
```

### Deployment Environments
```
Development:  https://dev.agents.visualforge.ai
Staging:      https://stg.agents.visualforge.ai
Production:   https://agents.visualforge.ai
```

## 📚 Documentation

### Core Documentation
- **[Architecture](docs/ARCHITECTURE.md)** - System design and technical architecture
- **[Deployment](docs/DEPLOYMENT.md)** - Complete deployment guide
- **[Testing](docs/TESTING.md)** - Comprehensive testing procedures
- **[Security](docs/SECURITY.md)** - Security architecture and procedures
- **[API Reference](docs/API.md)** - Agent API documentation
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions

### Quick Links
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute to the project
- **[Changelog](CHANGELOG.md)** - Version history and updates
- **[Repository Organization](REPOSITORY_ORGANIZATION_PLAN.md)** - Project structure guide

## 🔧 Development

### Project Structure
```
na-agents/
├── docs/                    # All documentation
├── src/                     # Source code
│   ├── agents/              # Agent implementations
│   ├── lib/                 # Shared libraries
│   ├── middleware/          # Express middleware
│   ├── services/            # Business services
│   └── types/               # TypeScript definitions
├── tests/                   # All testing code
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   ├── e2e/                 # End-to-end tests
│   └── regression-test.js   # Main regression suite
├── infrastructure/          # AWS CloudFormation templates
├── scripts/                 # Deployment and utility scripts
├── config/                  # Configuration files
└── .github/workflows/       # CI/CD workflows
```

### Available Commands
```bash
# Development
npm run dev                # Start all agents in development mode
npm run dev:architect      # Start individual agents
npm run dev:developer
npm run dev:devops
npm run dev:qa
npm run dev:manager

# Building
npm run build              # Build TypeScript
npm run build:docker       # Build Docker images

# Testing
npm test                   # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end tests
npm run test:regression    # Regression testing
npm run test:regression:dev   # Test against dev environment
npm run test:regression:stg   # Test against staging
npm run test:regression:prd   # Test against production

# Production
npm start                  # Start all agents in production mode
npm run start:architect    # Start individual agents
npm run lint               # Code linting
npm run format             # Code formatting
```

## 🔒 Security Features

### Multi-Layer Protection
- **WAF Protection**: Rate limiting, SQL injection, XSS filtering
- **API Authentication**: Secure API key validation
- **HTTPS Enforcement**: All traffic encrypted with TLS 1.3
- **Input Sanitization**: Request validation and sanitization
- **Audit Logging**: Complete request/response logging
- **CORS Protection**: Restricted cross-origin access

### Environment-Specific Security
```yaml
Development:
  Rate Limit: 2000 req/15min
  API Key: Development key
  
Staging:
  Rate Limit: 1500 req/15min
  API Key: Staging key
  
Production:
  Rate Limit: 1000 req/15min
  API Key: Production key
```

## 🔗 Integration

### Dashboard Integration
The agents integrate with the [NA-Agent Dashboard](https://github.com/NiroAgent/na-agent-dashboard) for visual monitoring and control.

```javascript
// Agent registration
POST /api/agents/register
{
  "id": "ai-architect-agent-1",
  "type": "architect",
  "port": 5001,
  "capabilities": ["system_design", "architecture"],
  "status": "online"
}

// Heartbeat monitoring
POST /api/agents/{agentId}/heartbeat
{
  "status": "running",
  "metrics": {
    "cpuUsage": 25.0,
    "memoryUsage": 45.2,
    "tasksCompleted": 142
  }
}
```

### GitHub Integration
Automatic agent assignment based on issue/PR labels:

```yaml
Label Mapping:
  architecture → architect-agent
  bug → developer-agent
  deployment → devops-agent
  testing → qa-agent
  coordination → manager-agent
```

### Chat Interface
Real-time communication via WebSocket:

```javascript
// Connect to chat interface
const socket = io('wss://dev.agents.visualforge.ai:7000');

// Send message to agent
socket.emit('message', {
  agentId: 'ai-architect-agent-1',
  message: 'Design a microservices architecture',
  conversationId: 'conv-123'
});
```

## 📈 Monitoring & Health

### Health Check Endpoints
```bash
# Basic health check
curl https://dev.agents.visualforge.ai:5001/health

# Detailed status
curl https://dev.agents.visualforge.ai:5001/status

# Queue information
curl https://dev.agents.visualforge.ai:5001/queue
```

### Performance Metrics
```yaml
Target Performance:
  Response Time: ≤ 200ms
  Throughput: ≥ 1000 req/min per agent
  Memory Usage: ≤ 512MB per agent
  CPU Usage: ≤ 25% per agent
  Uptime: ≥ 99.9%
```

### Monitoring Stack
- **CloudWatch**: Infrastructure and application metrics
- **Custom Metrics**: Agent-specific performance data
- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Health Checks**: Automated monitoring and alerting

## 🚀 CI/CD Pipeline

### GitHub Actions Workflows
- **Testing**: Automated testing on push/PR
- **Security**: Security scanning and vulnerability assessment
- **Building**: Docker image creation and registry push
- **Deployment**: Multi-environment deployment automation
- **Monitoring**: Post-deployment verification

### Deployment Environments
```yaml
Development:
  Trigger: Push to main/develop
  Auto-deploy: Yes
  AWS Account: 319040880702
  
Staging:
  Trigger: Manual approval
  Auto-deploy: With approval
  AWS Account: 275057778147
  
Production:
  Trigger: Release tags
  Auto-deploy: Manual only
  AWS Account: 229742714212
```

## 🧪 Testing

### Comprehensive Testing Suite
- **38 Regression Tests**: Complete system validation
- **Unit Tests**: Individual component testing
- **Integration Tests**: Service interaction testing
- **E2E Tests**: Complete workflow validation
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability and penetration testing

### Test Execution
```bash
# Environment-specific regression testing
npm run test:regression:dev    # 70% success threshold
npm run test:regression:stg    # 80% success threshold
npm run test:regression:prd    # 95% success threshold

# Comprehensive test suite
npm run test:all              # All test categories
npm run test:performance      # Performance benchmarks
npm run test:security         # Security validation
```

## 👥 Contributing

### Development Workflow
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Standards
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Conventional Commits**: Commit message format

### Review Process
- **Automated Testing**: All tests must pass
- **Security Scanning**: No critical vulnerabilities
- **Code Review**: At least one approval required
- **Documentation**: Updates required for new features

## 📚 Resources

### External Links
- **[Dashboard Repository](https://github.com/NiroAgent/na-agent-dashboard)** - Web dashboard for agent management
- **[Live Dashboard](https://dashboard.visualforge.ai)** - Production dashboard
- **[API Documentation](https://api.visualforge.ai/docs)** - Interactive API docs
- **[GitHub Actions](https://github.com/NiroAgent/na-agents/actions)** - CI/CD pipeline status

### Support
- **Issues**: [GitHub Issues](https://github.com/NiroAgent/na-agents/issues)
- **Discussions**: [GitHub Discussions](https://github.com/NiroAgent/na-agents/discussions)
- **Security**: security@niroagent.com
- **General**: support@niroagent.com

## 📋 Changelog

### v1.0.0 (Latest)
- ✅ Complete TypeScript conversion from Python
- ✅ Multi-agent architecture implementation
- ✅ Secure AWS deployment with WAF protection
- ✅ Comprehensive testing suite (38 tests)
- ✅ GitHub Actions CI/CD pipeline
- ✅ Dashboard integration
- ✅ WebSocket chat interface
- ✅ GitHub webhook integration
- ✅ Enterprise security features

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## 📄 License

Proprietary - NiroAgent/NiroLabs

---

## 🚀 Getting Started Checklist

- [ ] Install Node.js 18+
- [ ] Clone repository and install dependencies
- [ ] Configure environment variables
- [ ] Start agents locally with `npm start`
- [ ] Verify health checks are responding
- [ ] Review [Architecture Documentation](docs/ARCHITECTURE.md)
- [ ] Run regression tests with `npm run test:regression`
- [ ] Explore [Dashboard Integration](docs/DEPLOYMENT.md#dashboard-integration)
- [ ] Set up GitHub webhooks for automation
- [ ] Deploy to development environment

---

**Built with ❤️ by the NiroAgent team**  
*Saving developers time through intelligent automation*

[![NiroAgent](https://img.shields.io/badge/Built%20by-NiroAgent-blue.svg)](https://niroagent.com)
[![TypeScript](https://img.shields.io/badge/Made%20with-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![AWS](https://img.shields.io/badge/Deployed%20on-AWS-orange.svg)](https://aws.amazon.com/)