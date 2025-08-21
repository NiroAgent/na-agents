# 🔗 NA-Agents API Documentation

## Overview

Complete API reference for the NA-Agents multi-agent system, including agent endpoints, authentication, request/response formats, and integration examples.

## Base URLs

```
Development:  https://dev.agents.visualforge.ai
Staging:      https://stg.agents.visualforge.ai
Production:   https://agents.visualforge.ai
```

## Authentication

### API Key Authentication
All requests require an API key in the header:

```http
X-API-Key: your-api-key-here
Content-Type: application/json
```

#### Environment-Specific Keys
```yaml
Development: dev-api-key-[random]
Staging:     stg-api-key-[random]
Production:  prd-api-key-[random]
```

### Example Request
```bash
curl -X GET "https://dev.agents.visualforge.ai:5001/health" \
  -H "X-API-Key: dev-api-key-12345" \
  -H "Content-Type: application/json"
```

## Agent Endpoints

### Architect Agent (Port 5001)

#### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "agentId": "ai-architect-agent-1",
  "type": "architect",
  "timestamp": "2025-08-21T10:30:00Z",
  "uptime": 3600,
  "version": "1.0.0"
}
```

#### Agent Status
```http
GET /status
```

**Response:**
```json
{
  "agentId": "ai-architect-agent-1",
  "type": "architect",
  "status": "idle",
  "metrics": {
    "cpuUsage": 15.2,
    "memoryUsage": 45.8,
    "tasksCompleted": 142,
    "currentTasks": 0,
    "uptime": 3600
  },
  "queueSize": 0,
  "capabilities": [
    "system_design",
    "architecture_review",
    "documentation",
    "scalability_analysis"
  ],
  "timestamp": "2025-08-21T10:30:00Z"
}
```

#### Task Assignment
```http
POST /agent/{agentId}/task
```

**Request Body:**
```json
{
  "taskId": "task-123",
  "task": "Design a microservices architecture for an e-commerce platform",
  "priority": 5,
  "metadata": {
    "requirements": [
      "High availability",
      "Scalable to 1M users",
      "Cloud-native"
    ],
    "constraints": {
      "budget": "$10k/month",
      "timeline": "2 weeks"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "task-123",
  "agentId": "ai-architect-agent-1",
  "status": "accepted",
  "queuePosition": 1,
  "estimatedStartTime": "2025-08-21T10:35:00Z",
  "estimatedCompletionTime": "2025-08-21T11:35:00Z"
}
```

#### Task Queue Status
```http
GET /queue
```

**Response:**
```json
{
  "queueSize": 3,
  "processing": true,
  "currentTask": {
    "id": "task-123",
    "type": "architecture_design",
    "priority": 5,
    "startedAt": "2025-08-21T10:30:00Z",
    "estimatedCompletion": "2025-08-21T11:30:00Z"
  },
  "pendingTasks": [
    {
      "id": "task-124",
      "type": "system_review",
      "priority": 3,
      "waitTime": 120000
    }
  ]
}
```

### Developer Agent (Port 5002)

#### Task Assignment
```http
POST /agent/{agentId}/task
```

**Request Body:**
```json
{
  "taskId": "dev-task-456",
  "task": "Implement user authentication API with JWT tokens",
  "priority": 8,
  "metadata": {
    "language": "TypeScript",
    "framework": "Express.js",
    "requirements": [
      "JWT token generation",
      "Password hashing with bcrypt",
      "Rate limiting",
      "Input validation"
    ],
    "tests": true,
    "documentation": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "dev-task-456",
  "agentId": "ai-developer-agent-1",
  "status": "accepted",
  "estimatedLines": 250,
  "estimatedFiles": 5,
  "estimatedTime": "45 minutes"
}
```

### DevOps Agent (Port 5003)

#### Deployment Task
```http
POST /agent/{agentId}/task
```

**Request Body:**
```json
{
  "taskId": "deploy-task-789",
  "task": "Set up CI/CD pipeline for microservices deployment",
  "priority": 7,
  "metadata": {
    "platform": "AWS",
    "services": ["ECS", "CodePipeline", "CodeBuild"],
    "environments": ["dev", "staging", "production"],
    "requirements": [
      "Blue-green deployment",
      "Automated testing",
      "Rollback capability",
      "Infrastructure as Code"
    ]
  }
}
```

### QA Agent (Port 5004)

#### Testing Task
```http
POST /agent/{agentId}/task
```

**Request Body:**
```json
{
  "taskId": "qa-task-101",
  "task": "Create comprehensive test suite for user management API",
  "priority": 6,
  "metadata": {
    "testTypes": [
      "unit",
      "integration",
      "e2e",
      "performance",
      "security"
    ],
    "coverage": {
      "minimum": 90,
      "target": 95
    },
    "framework": "Jest",
    "apiEndpoints": [
      "/api/users",
      "/api/auth/login",
      "/api/auth/register"
    ]
  }
}
```

### Manager Agent (Port 5005)

#### Project Coordination
```http
POST /agent/{agentId}/task
```

**Request Body:**
```json
{
  "taskId": "mgr-task-202",
  "task": "Coordinate development of user management system",
  "priority": 9,
  "metadata": {
    "project": "User Management v2.0",
    "agents": ["architect", "developer", "devops", "qa"],
    "timeline": {
      "start": "2025-08-21",
      "end": "2025-09-21",
      "milestones": [
        {
          "name": "Architecture Design",
          "date": "2025-08-28",
          "agent": "architect"
        },
        {
          "name": "API Implementation",
          "date": "2025-09-07",
          "agent": "developer"
        }
      ]
    }
  }
}
```

## Chat Interface API (Port 7000)

### WebSocket Connection
```javascript
// Connect to chat interface
const socket = io('wss://dev.agents.visualforge.ai:7000', {
  auth: {
    apiKey: 'your-api-key'
  }
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to chat interface');
});

socket.on('disconnect', () => {
  console.log('Disconnected from chat interface');
});
```

### Send Message to Agent
```javascript
// Send message to specific agent
socket.emit('message', {
  agentId: 'ai-architect-agent-1',
  message: 'Can you help me design a scalable API architecture?',
  conversationId: 'conv-12345',
  context: {
    projectType: 'e-commerce',
    userCount: '1M+',
    budget: '$50k'
  }
});
```

### Receive Agent Response
```javascript
// Listen for agent responses
socket.on('agentResponse', (data) => {
  console.log(`${data.agentType} (${data.agentId}): ${data.message}`);
  
  // Data structure:
  // {
  //   agentId: 'ai-architect-agent-1',
  //   agentType: 'architect',
  //   message: 'I can help you design a scalable API architecture...',
  //   conversationId: 'conv-12345',
  //   timestamp: '2025-08-21T10:30:00Z',
  //   attachments: [
  //     {
  //       type: 'diagram',
  //       url: 'https://...',
  //       title: 'API Architecture Diagram'
  //     }
  //   ]
  // }
});
```

### Agent Selection
```javascript
// Select specific agent for conversation
socket.emit('selectAgent', {
  agentType: 'developer',
  conversationId: 'conv-12345'
});

// Auto-select agent based on message content
socket.emit('autoSelectAgent', {
  message: 'I need help with deployment configuration',
  conversationId: 'conv-12345'
});
```

## GitHub Integration API (Port 6000)

### Webhook Endpoint
```http
POST /github/webhook
```

**Headers:**
```
X-GitHub-Event: issues
X-Hub-Signature-256: sha256=...
Content-Type: application/json
```

**Request Body (Issue Event):**
```json
{
  "action": "opened",
  "issue": {
    "id": 123456,
    "number": 42,
    "title": "Implement user authentication system",
    "body": "We need to implement a secure user authentication system...",
    "labels": [
      {
        "name": "enhancement",
        "color": "a2eeef"
      },
      {
        "name": "backend",
        "color": "d4c5f9"
      }
    ],
    "assignees": [],
    "state": "open"
  },
  "repository": {
    "id": 789012,
    "name": "my-project",
    "full_name": "myorg/my-project"
  }
}
```

**Response:**
```json
{
  "success": true,
  "action": "issue_assigned",
  "assignedAgent": {
    "id": "ai-developer-agent-1",
    "type": "developer",
    "confidence": 0.95
  },
  "taskId": "github-task-42",
  "estimatedCompletion": "2025-08-21T12:00:00Z"
}
```

### Manual Agent Assignment
```http
POST /github/assign-agent
```

**Request Body:**
```json
{
  "issueNumber": 42,
  "repository": "myorg/my-project",
  "agentType": "architect",
  "force": false
}
```

## Dashboard Integration API

### Agent Registration
```http
POST /api/agents/register
```

**Request Body:**
```json
{
  "id": "ai-architect-agent-1",
  "type": "architect",
  "port": 5001,
  "capabilities": [
    "system_design",
    "architecture_review",
    "documentation",
    "scalability_analysis"
  ],
  "status": "online",
  "version": "1.0.0",
  "metadata": {
    "location": "us-east-1",
    "instanceId": "i-1234567890abcdef0"
  }
}
```

### Heartbeat
```http
POST /api/agents/{agentId}/heartbeat
```

**Request Body:**
```json
{
  "status": "running",
  "metrics": {
    "cpuUsage": 25.0,
    "memoryUsage": 45.2,
    "diskUsage": 15.8,
    "networkIn": 1024,
    "networkOut": 2048,
    "tasksCompleted": 142,
    "currentTasks": 3
  },
  "cost": {
    "hourly": 0.001,
    "daily": 0.024,
    "monthly": 0.72
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

## Error Responses

### Standard Error Format
```json
{
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific error details"
  },
  "timestamp": "2025-08-21T10:30:00Z",
  "traceId": "trace-12345"
}
```

### Common Error Codes

#### Authentication Errors
```json
// 401 - Missing API Key
{
  "error": "Missing API key",
  "code": "MISSING_API_KEY",
  "timestamp": "2025-08-21T10:30:00Z"
}

// 401 - Invalid API Key
{
  "error": "Invalid API key",
  "code": "INVALID_API_KEY",
  "timestamp": "2025-08-21T10:30:00Z"
}
```

#### Validation Errors
```json
// 400 - Invalid Payload
{
  "error": "Invalid payload",
  "code": "VALIDATION_ERROR",
  "details": {
    "taskId": "Task ID is required",
    "priority": "Priority must be between 1 and 10"
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

#### Rate Limiting
```json
// 429 - Rate Limit Exceeded
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "limit": 1000,
    "window": "15 minutes",
    "retryAfter": 900
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

#### Server Errors
```json
// 503 - Agent Unavailable
{
  "error": "Agent temporarily unavailable",
  "code": "AGENT_UNAVAILABLE",
  "details": {
    "agentId": "ai-architect-agent-1",
    "reason": "overloaded",
    "retryAfter": 300
  },
  "timestamp": "2025-08-21T10:30:00Z"
}
```

## Rate Limiting

### Environment-Specific Limits
```yaml
Development:
  Limit: 2000 requests per 15 minutes
  Burst: 100 requests per minute
  
Staging:
  Limit: 1500 requests per 15 minutes
  Burst: 75 requests per minute
  
Production:
  Limit: 1000 requests per 15 minutes
  Burst: 50 requests per minute
```

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1629541800
X-RateLimit-Window: 900
```

## SDKs and Libraries

### TypeScript/JavaScript SDK
```bash
npm install @niroagent/na-agents-sdk
```

#### Usage Example
```typescript
import { NAAgentsClient } from '@niroagent/na-agents-sdk';

const client = new NAAgentsClient({
  baseUrl: 'https://dev.agents.visualforge.ai',
  apiKey: 'your-api-key',
  timeout: 30000
});

// Assign task to architect agent
const result = await client.agents.architect.assignTask({
  taskId: 'task-123',
  task: 'Design microservices architecture',
  priority: 5
});

// Get agent status
const status = await client.agents.architect.getStatus();

// Send chat message
const response = await client.chat.sendMessage({
  agentType: 'developer',
  message: 'Help me implement user authentication',
  conversationId: 'conv-123'
});
```

### Python SDK
```bash
pip install na-agents-sdk
```

#### Usage Example
```python
from na_agents_sdk import NAAgentsClient

client = NAAgentsClient(
    base_url='https://dev.agents.visualforge.ai',
    api_key='your-api-key'
)

# Assign task
result = client.agents.developer.assign_task(
    task_id='task-456',
    task='Implement REST API endpoints',
    priority=7
)

# Get queue status
queue = client.agents.developer.get_queue()

# Chat with agent
response = client.chat.send_message(
    agent_type='qa',
    message='Create test cases for the new API',
    conversation_id='conv-456'
)
```

## Webhooks

### Configuring Webhooks
```http
POST /api/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/na-agents",
  "events": [
    "task.completed",
    "task.failed",
    "agent.status_changed"
  ],
  "secret": "your-webhook-secret"
}
```

### Webhook Events

#### Task Completed
```json
{
  "event": "task.completed",
  "timestamp": "2025-08-21T10:30:00Z",
  "data": {
    "taskId": "task-123",
    "agentId": "ai-architect-agent-1",
    "agentType": "architect",
    "result": {
      "type": "architecture_document",
      "content": "...",
      "attachments": [
        {
          "type": "diagram",
          "url": "https://..."
        }
      ]
    },
    "metrics": {
      "executionTime": 1800,
      "linesOfCode": 0,
      "filesCreated": 3
    }
  }
}
```

#### Agent Status Changed
```json
{
  "event": "agent.status_changed",
  "timestamp": "2025-08-21T10:30:00Z",
  "data": {
    "agentId": "ai-developer-agent-1",
    "agentType": "developer",
    "previousStatus": "idle",
    "currentStatus": "busy",
    "reason": "task_assigned",
    "taskId": "task-456"
  }
}
```

## API Versioning

### Version Header
```http
API-Version: v1
Accept: application/vnd.na-agents.v1+json
```

### Supported Versions
```yaml
v1: Current stable version
v1.1: Beta features (optional)
v2: Future version (development)
```

### Deprecation Policy
```yaml
Notice Period: 6 months
Support Period: 12 months after deprecation
Migration Guide: Provided for major version changes
```

---

*Last Updated: August 21, 2025*  
*API Version: v1.0.0*  
*Documentation Status: Complete*