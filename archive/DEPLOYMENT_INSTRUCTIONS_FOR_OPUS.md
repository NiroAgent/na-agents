# 🚀 Agent Deployment Instructions for Opus

## 📋 **Mission Overview**
Deploy and configure multiple AI agents to integrate with the existing dashboard system. Currently, the dashboard only discovers 1 agent from AWS. We need to deploy 5 functional agents that can handle real tasks and communicate with the dashboard.

## 🎯 **Current Status**
- ✅ **Dashboard API:** Running on http://localhost:4001 with external data integration
- ✅ **Dashboard UI:** Running on http://localhost:5173 (has some errors to fix)
- ✅ **Agent Discovery:** Finding 1 AWS EC2 agent (`vf-dev-agent-instance`)
- ❌ **Multi-Agent Infrastructure:** Need to deploy and register 5+ agents
- ❌ **Task Handling:** Agents need to accept and process tasks from dashboard

## 🔧 **Available Agent Files**
Located in `E:\Projects\NiroAgent\na-agents\`:
- `ai-architect-agent.py` - System architecture and design agent
- `ai-developer-agent.py` - Code implementation and development agent  
- `ai-devops-agent.py` - Infrastructure and deployment agent
- `ai-qa-agent.py` - Quality assurance and testing agent
- `ai-manager-agent.py` - Project management and coordination agent
- `enhanced-batch-agent-processor.py` - Batch processing coordination
- `github-agent-dispatcher.py` - GitHub integration agent

## 🎯 **Deployment Requirements**

### **1. Agent Registration with Dashboard**
Each agent must register with the dashboard API at `http://localhost:4001` by:
- Sending heartbeat signals to `/api/dashboard/agents/{agentId}/heartbeat`
- Providing agent metadata (type, capabilities, status, cost)
- Setting proper AWS tags if deploying to EC2 instances

### **2. Task Handling Endpoints**
Each agent needs to implement:
- **POST** `/agent/{agentId}/task` - Accept task assignments
- **POST** `/agent/{agentId}/message` - Handle messages from dashboard
- **GET** `/agent/{agentId}/status` - Report current status
- **GET** `/agent/{agentId}/conversation` - Return conversation history

### **3. Communication Protocol**
Agents should:
- Accept JSON task payloads with `task`, `priority`, `context` fields
- Return task results with `taskId`, `status`, `result` fields
- Send status updates to dashboard every 30 seconds
- Handle message passing between agents for coordination

### **4. AWS Integration**
If deploying to AWS:
- Tag instances with `AgentType=architect|developer|devops|qa|manager`
- Configure CloudWatch metrics for CPU, memory, network monitoring
- Set up cost tracking integration
- Ensure instances are discoverable by dashboard's AWS SDK integration

## 📊 **Expected Dashboard Integration**

### **Agent Discovery**
The dashboard should discover agents via:
- AWS EC2 tag-based discovery (`AgentType` tags)
- Direct agent registration API calls
- Health check endpoints for connectivity verification

### **Task Distribution**
Dashboard will send tasks via:
```json
POST /agent/{agentId}/task
{
  "task": "Implement user authentication system",
  "priority": "high",
  "context": {
    "project": "dashboard-enhancement",
    "timeout": 300,
    "dependencies": []
  }
}
```

### **Agent Coordination**
Enable agents to:
- Receive coordinated workflows (architect → developer → qa → devops)
- Share context and results between agents
- Report progress to manager agent
- Handle concurrent task execution

## 🔗 **Dashboard API Endpoints**
The dashboard provides these endpoints for agent integration:
- **GET** `/api/dashboard/agents` - List all discovered agents
- **POST** `/api/dashboard/agents/{agentId}/task` - Submit task to agent
- **POST** `/api/dashboard/agents/{agentId}/message` - Send message to agent
- **GET** `/api/dashboard/agents/{agentId}/conversation` - Get conversation history
- **POST** `/api/dashboard/agents/{agentId}/control` - Control agent (start/stop/restart)

## 🎯 **Deployment Priorities**

### **Phase 1: Local Deployment**
1. Deploy agents as local services on different ports
2. Configure agent registration with dashboard
3. Implement basic task handling
4. Test agent discovery and communication

### **Phase 2: AWS Deployment**
1. Deploy agents to EC2 instances with proper tagging
2. Configure CloudWatch monitoring
3. Set up cost tracking integration
4. Test external data integration

### **Phase 3: Multi-Agent Coordination**
1. Implement workflow coordination between agents
2. Enable message passing and result sharing
3. Set up concurrent task handling
4. Test full end-to-end workflows

## 🔍 **Testing Integration**
After deployment, verify:
- Dashboard discovers all deployed agents
- Agents appear in UI with real-time metrics
- Task submission APIs work end-to-end
- Playwright tests show multiple active agents
- Agent coordination workflows function properly

## 📝 **Agent Configuration Template**
Each agent should follow this structure:
```python
# Agent Configuration
AGENT_ID = "ai-architect-agent-1"
AGENT_TYPE = "architect"
DASHBOARD_URL = "http://localhost:4001"
AGENT_PORT = 5001  # Different port per agent

# Required endpoints
@app.route('/task', methods=['POST'])
def handle_task():
    # Process task and return result
    pass

@app.route('/message', methods=['POST']) 
def handle_message():
    # Handle inter-agent communication
    pass

@app.route('/status', methods=['GET'])
def get_status():
    # Return agent health and status
    pass

# Dashboard registration
def register_with_dashboard():
    # Send agent metadata to dashboard
    pass

# Heartbeat mechanism
def send_heartbeat():
    # Send periodic status updates
    pass
```

## 🎯 **Success Criteria**
Deployment is complete when:
- ✅ 5+ agents are running and discoverable
- ✅ Dashboard shows multiple agents with live metrics
- ✅ Task submission works for all agents
- ✅ Agent coordination workflows execute successfully
- ✅ Playwright tests pass with real multi-agent data
- ✅ UI displays all agents without errors

## 🆘 **Support Resources**
- **Dashboard API:** http://localhost:4001 (check `/health` endpoint)
- **Dashboard UI:** http://localhost:5173
- **AWS Integration:** Uses AWS SDK for EC2, ECS, CloudWatch discovery
- **Existing Agent:** `vf-dev-agent-instance` on EC2 `i-0af59b7036f7b0b77` as reference

## 🤝 **Coordination with Claude**
While you deploy agents, Claude will:
- Fix UI console errors and data loading issues
- Improve dashboard interface and real-time updates
- Enhance external data integration
- Polish multi-agent monitoring and visualization

**Goal:** Transform from 1 discovered agent to 5+ functional agents with real task handling capabilities!
