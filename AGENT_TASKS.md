# AI Agent System - Development Tasks

## Current Working Directory
`~/Projects/NiroAgent/na-agents` (in WSL2)

## Immediate Tasks (Priority Order)

### 1. Fix Critical Bug - Task Processing Error
**Issue**: All agents failing with "Cannot read properties of undefined (reading 'toLowerCase')"
**Files to Fix**:
- `src/agents/architect-agent.ts` - Lines 91, 94, 100, 103
- `src/agents/developer-agent.ts` - Lines 91, 96, 99, 102
- `src/agents/devops-agent.ts` - Lines 83, 86, 89
- `src/agents/qa-agent.ts` - Lines 91, 94, 97, 100
- `src/agents/manager-agent.ts` - Lines 87-88, 91, 94-95, 98, 193-194, 201-202

**Fix**: Replace all instances of `payload.task.toLowerCase()` with `(payload.task || "").toLowerCase()`

### 2. Build Dashboard UI
**Port**: 4001
**Location**: `src/dashboard/`
**Requirements**:
- Express server with static files
- Real-time WebSocket updates
- Agent status monitoring
- Task queue visualization
- Inter-agent communication logs
- Performance metrics
- HTML/CSS/JS frontend (no heavy frameworks initially)

### 3. Implement Agent Discovery System
- Create `/discover` endpoint on each agent
- Central registry at dashboard
- Automatic agent registration on startup
- Health check monitoring

### 4. Add Inter-Agent Communication
- Message routing between agents
- Task delegation from Manager to other agents
- Result callbacks
- Event broadcasting

### 5. Database Integration
**DynamoDB Tables** (already exist in AWS):
- `vf-ai-agents-dev` - Agent registry
- `vf-ai-generations-dev` - Tasks
- `vf-ai-messages-dev` - Messages
- `vf-workflows-dev` - Workflows

### 6. Testing & Verification
- Run `npm test` to verify all fixes
- Test inter-agent communication
- Verify dashboard real-time updates
- Load test with concurrent tasks

## Project Structure
```
na-agents/
├── src/
│   ├── agents/        # 5 agent implementations
│   ├── lib/           # BaseAgent class
│   ├── services/      # Copilot, DynamoDB services
│   └── dashboard/     # NEW - Dashboard UI
├── test/
├── logs/
└── package.json
```

## Environment Variables Required
```bash
DASHBOARD_URL=http://localhost:4001
GITHUB_TOKEN=<token>
AWS_REGION=us-east-1
DYNAMODB_AGENTS_TABLE=vf-ai-agents-dev
DYNAMODB_TASKS_TABLE=vf-ai-generations-dev
DYNAMODB_MESSAGES_TABLE=vf-ai-messages-dev
DYNAMODB_WORKFLOWS_TABLE=vf-workflows-dev
```

## Commands to Run
```bash
# In WSL2
cd ~/Projects/NiroAgent/na-agents
npm install
npm run build
npm test
npm run start-all  # Start all agents
```

## Success Criteria
- All agents start without errors
- Dashboard accessible at http://localhost:4001
- Agents can communicate with each other
- Tasks persist to DynamoDB
- Real-time updates working
- All tests passing