# 🏗️ NA-Agents System Architecture

## Overview

The NA-Agents system is a multi-agent AI architecture designed for collaborative software development tasks. Built with TypeScript and modern cloud-native technologies, it provides a scalable, secure, and efficient platform for automated development workflows.

## System Architecture

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│                            User Interfaces                          │
├─────────────────────┬───────────────────┬───────────────────────────┤
│   Web Dashboard     │   Chat Interface  │   GitHub Integration      │
│   (Port 4001)       │   (Port 7000)     │   (Port 6000)             │
└─────────────────────┼───────────────────┼───────────────────────────┘
                      │                   │
                      ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API Gateway + WAF                           │
│                   (dev.agents.visualforge.ai)                      │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Agent Orchestra                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Architect   │ │ Developer   │ │ DevOps      │ │ QA Agent    │   │
│  │ Agent       │ │ Agent       │ │ Agent       │ │ (5004)      │   │
│  │ (5001)      │ │ (5002)      │ │ (5003)      │ │             │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                        ┌─────────────┐                             │
│                        │ Manager     │                             │
│                        │ Agent       │                             │
│                        │ (5005)      │                             │
│                        └─────────────┘                             │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Data & Services Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ DynamoDB    │ │ SQS/Redis   │ │ S3 Storage  │ │ CloudWatch  │   │
│  │ Database    │ │ Message     │ │ File        │ │ Monitoring  │   │
│  │             │ │ Queue       │ │ Storage     │ │             │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Agent Architecture

### Agent Types and Responsibilities

#### 🏗️ Architect Agent (Port 5001)
**Purpose**: System design and technical architecture
**Capabilities**:
- System architecture design
- Technical specification creation
- Design pattern recommendations
- Scalability analysis
- Security architecture review

**API Endpoints**:
```
GET  /health              # Health check
POST /agent/{id}/task     # Task assignment
GET  /agent/{id}/status   # Agent status
GET  /queue               # Task queue status
```

#### 👨‍💻 Developer Agent (Port 5002)
**Purpose**: Code generation and implementation
**Capabilities**:
- Production code generation
- Code refactoring
- Bug fixing
- Feature implementation
- Code review

#### 🚀 DevOps Agent (Port 5003)
**Purpose**: Deployment and infrastructure management
**Capabilities**:
- CI/CD pipeline management
- Infrastructure as Code
- Container orchestration
- Monitoring setup
- Security compliance

#### 🧪 QA Agent (Port 5004)
**Purpose**: Testing and quality assurance
**Capabilities**:
- Test case generation
- Automated testing
- Performance testing
- Security testing
- Quality metrics analysis

#### 📊 Manager Agent (Port 5005)
**Purpose**: Project coordination and orchestration
**Capabilities**:
- Task prioritization
- Resource allocation
- Progress tracking
- Inter-agent coordination
- Reporting and analytics

### Agent Communication Protocol

#### Message Types
```typescript
interface AgentMessage {
  id: string;
  type: 'task' | 'status' | 'result' | 'error';
  from: string;
  to: string;
  payload: any;
  timestamp: Date;
  priority: number;
}

interface Task {
  id: string;
  type: string;
  payload: any;
  priority: number;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}
```

#### Communication Patterns
1. **Direct Communication**: Agent-to-agent via HTTP/WebSocket
2. **Queue-based**: Async task distribution via SQS/Redis
3. **Broadcast**: Manager agent coordinates multiple agents
4. **Event-driven**: Real-time updates via WebSocket

## Technology Stack

### Core Technologies
```yaml
Runtime: Node.js 18+
Language: TypeScript
Framework: Express.js
WebSocket: Socket.IO
Database: DynamoDB / PostgreSQL
Message Queue: AWS SQS / Redis
Containerization: Docker
Orchestration: Docker Compose / Kubernetes
```

### Cloud Infrastructure
```yaml
Cloud Provider: AWS
Compute: ECS Fargate / Lambda
Database: DynamoDB
Storage: S3
Networking: VPC, Application Load Balancer
Security: WAF, API Gateway, IAM
Monitoring: CloudWatch, X-Ray
DNS: Route53
Certificates: ACM
```

### Development Tools
```yaml
Version Control: Git / GitHub
CI/CD: GitHub Actions
Testing: Jest, Playwright
Linting: ESLint, Prettier
Security: SonarCloud, Snyk
Docs: TypeDoc, Markdown
```

## Deployment Architecture

### Environment Structure
```
Development:  dev.agents.visualforge.ai  (Account: 319040880702)
Staging:      stg.agents.visualforge.ai  (Account: 275057778147)
Production:   agents.visualforge.ai      (Account: 229742714212)
```

### Container Architecture
```yaml
# docker-compose.yml structure
services:
  architect-agent:
    image: na-agents:latest
    command: npm run start:architect
    ports: ["5001:5001"]
    environment:
      AGENT_TYPE: architect
      AGENT_PORT: 5001
      
  developer-agent:
    image: na-agents:latest
    command: npm run start:developer
    ports: ["5002:5002"]
    
  devops-agent:
    image: na-agents:latest
    command: npm run start:devops
    ports: ["5003:5003"]
    
  qa-agent:
    image: na-agents:latest
    command: npm run start:qa
    ports: ["5004:5004"]
    
  manager-agent:
    image: na-agents:latest
    command: npm run start:manager
    ports: ["5005:5005"]
    
  chat-interface:
    image: na-agents:latest
    command: npm run start:chat
    ports: ["7000:7000"]
    
  github-service:
    image: na-agents:latest
    command: npm run start:github
    ports: ["6000:6000"]
```

## Security Architecture

### Multi-Layer Security

#### 1. Network Security
```yaml
WAF Rules:
  - Rate limiting (environment-specific)
  - SQL injection protection
  - XSS filtering
  - Geographic blocking
  - Known bad input patterns

Load Balancer:
  - SSL termination
  - Health checks
  - Traffic distribution
  - DDoS protection
```

#### 2. Application Security
```typescript
// API key authentication
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;
  
  if (!timingSafeEqual(Buffer.from(apiKey), Buffer.from(expectedKey))) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
};

// Request sanitization
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body, query params, headers
  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  next();
};
```

#### 3. Data Security
```yaml
Encryption:
  - At rest: DynamoDB encryption
  - In transit: TLS 1.3
  - Secrets: AWS Secrets Manager
  
Access Control:
  - IAM roles and policies
  - Least privilege principle
  - Service-to-service authentication
  
Audit Logging:
  - All API requests logged
  - CloudWatch integration
  - Compliance reporting
```

## Data Architecture

### Database Schema

#### Agents Table
```typescript
interface Agent {
  id: string;           // Partition key
  type: string;         // architect, developer, devops, qa, manager
  status: string;       // online, offline, busy, error
  port: number;
  capabilities: string[];
  metrics: {
    tasksCompleted: number;
    currentTasks: number;
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  };
  lastHeartbeat: Date;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Tasks Table
```typescript
interface Task {
  id: string;           // Partition key
  type: string;
  status: string;       // pending, in_progress, completed, failed
  assignedTo: string;   // Agent ID
  priority: number;
  payload: any;
  result?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
}
```

#### Messages Table
```typescript
interface Message {
  id: string;           // Partition key
  conversationId: string; // Sort key
  from: string;         // Agent ID or user ID
  to: string;           // Agent ID or user ID
  type: string;         // chat, task, status, error
  content: string;
  metadata: any;
  timestamp: Date;
  read: boolean;
}
```

## Integration Architecture

### Dashboard Integration
```typescript
// Agent registration
POST /api/agents/register
{
  "id": "ai-architect-agent-1",
  "type": "architect",
  "port": 5001,
  "capabilities": ["system_design", "architecture", "documentation"],
  "status": "online",
  "version": "1.0.0"
}

// Heartbeat mechanism
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
```typescript
// Webhook configuration
const webhookConfig = {
  url: 'https://dev.agents.visualforge.ai:6000/github/webhook',
  events: ['issues', 'pull_request', 'push'],
  secret: process.env.GITHUB_WEBHOOK_SECRET
};

// Agent assignment based on labels
const agentAssignment = {
  'architecture': 'architect-agent',
  'bug': 'developer-agent',
  'deployment': 'devops-agent',
  'testing': 'qa-agent',
  'coordination': 'manager-agent'
};
```

### Chat Interface Integration
```typescript
// WebSocket connection
const socket = io('wss://dev.agents.visualforge.ai:7000');

// Agent selection and communication
socket.emit('selectAgent', { agentType: 'architect' });
socket.emit('message', {
  agentId: 'ai-architect-agent-1',
  message: 'Please design a microservices architecture',
  conversationId: 'conv-123'
});

// Real-time updates
socket.on('agentResponse', (data) => {
  console.log(`Agent ${data.agentId}: ${data.message}`);
});
```

## Performance Architecture

### Scalability Patterns
```yaml
Horizontal Scaling:
  - Multiple agent instances
  - Load balancing
  - Auto-scaling groups
  
Vertical Scaling:
  - Resource allocation per agent
  - Performance monitoring
  - Dynamic resource adjustment
  
Caching:
  - Redis for session data
  - CloudFront for static assets
  - Application-level caching
```

### Performance Targets
```yaml
Response Time:
  - API endpoints: ≤ 200ms
  - Agent task processing: ≤ 30s
  - WebSocket messages: ≤ 100ms
  
Throughput:
  - 1000 requests/minute per agent
  - 100 concurrent connections
  - 10 agents per environment
  
Resource Usage:
  - CPU: ≤ 25% per agent
  - Memory: ≤ 512MB per agent
  - Storage: ≤ 10GB per environment
```

## Monitoring Architecture

### Observability Stack
```yaml
Metrics:
  - Custom application metrics
  - Infrastructure metrics
  - Business metrics
  
Logging:
  - Structured logging (JSON)
  - Centralized log aggregation
  - Log correlation
  
Tracing:
  - Distributed tracing
  - Request correlation
  - Performance profiling
  
Alerting:
  - Proactive alerting
  - Escalation policies
  - Incident management
```

### Health Checks
```typescript
// Agent health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version
  };
  
  res.json(health);
});

// Detailed status endpoint
app.get('/status', (req, res) => {
  const status = {
    agentId: this.agentId,
    type: this.agentType,
    status: this.isProcessing ? 'busy' : 'idle',
    metrics: this.getCurrentMetrics(),
    queueSize: this.taskQueue.length,
    lastTaskCompleted: this.lastTaskCompleted,
    capabilities: this.capabilities
  };
  
  res.json(status);
});
```

## Migration Architecture

### Python to TypeScript Migration
```yaml
Phase 1: Parallel Deployment
  - Run both Python and TypeScript systems
  - Dual endpoint support in dashboard
  - Comparative testing
  
Phase 2: Gradual Migration
  - Service-by-service migration
  - Feature flag controlled rollout
  - Rollback capability
  
Phase 3: Complete Migration
  - All traffic to TypeScript
  - Python system retirement
  - Legacy code cleanup
```

### Service Testing Matrix
```yaml
VisualForgeV2 Services (10):
  - vf-dashboard-service
  - vf-audio-service
  - vf-video-service
  - vf-image-service
  - vf-text-service
  - vf-database-service
  - vf-analytics-service
  - vf-notification-service
  - vf-payment-service
  - vf-user-service
  
NiroSubsV2 Services (8):
  - nirosubs-auth-service
  - nirosubs-payment-service
  - nirosubs-user-management
  - nirosubs-subscription-service
  - nirosubs-content-service
  - nirosubs-notification-service
  - nirosubs-analytics-service
  - nirosubs-billing-service
```

## Future Architecture Considerations

### Planned Enhancements
```yaml
AI/ML Integration:
  - Enhanced agent intelligence
  - Predictive task assignment
  - Automated optimization
  
Multi-Cloud Support:
  - Cloud provider abstraction
  - Disaster recovery
  - Cost optimization
  
Advanced Security:
  - Zero-trust architecture
  - Advanced threat detection
  - Compliance automation
  
Developer Experience:
  - Local development tools
  - Testing frameworks
  - Documentation automation
```

### Scalability Roadmap
```yaml
Short-term (3 months):
  - Multi-environment deployment
  - Performance optimization
  - Security hardening
  
Medium-term (6 months):
  - Kubernetes migration
  - Service mesh implementation
  - Advanced monitoring
  
Long-term (12 months):
  - Multi-region deployment
  - AI-powered optimization
  - Advanced analytics
```

---

*Last Updated: August 21, 2025*  
*Documentation Status: Consolidated from INTEGRATION_PLAN.md and architecture specifications*