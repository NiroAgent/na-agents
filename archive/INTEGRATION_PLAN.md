# 🚀 NA-Agents & Dashboard Integration Plan

**Claude (Sonnet 4) Taking Full Ownership of Both Projects**

## 📋 **Current Status**

### **Existing Infrastructure (Sonnet's Work)**
- **Server**: `i-0af59b7036f7b0b77` (98.81.93.132)
- **Port**: 7777 (Python API)
- **Dashboard**: http://localhost:5003
- **Active Agents**: QA, Developer, Operations (Python)
- **Coverage**: 18 services (10 VisualForgeV2 + 8 NiroSubsV2)
- **Status**: LIVE and actively testing

### **New Infrastructure (Claude's Work)**
- **Domain**: `dev.agents.visualforge.ai`
- **Agents**: TypeScript-based (5 agents on ports 5001-5005)
- **Security**: WAF, API keys, rate limiting
- **Chat**: WebSocket on port 7000
- **Status**: Deploying now

## 🔄 **Integration Strategy**

### **Phase 1: Parallel Deployment (Immediate)**

**Objective**: Run both systems simultaneously for testing

**Actions**:
1. ✅ Deploy TypeScript agents to `dev.agents.visualforge.ai`
2. ✅ Keep Python agents running on 98.81.93.132
3. 🔄 Update dashboard to support both endpoints
4. 🔄 Test TypeScript agents against same 18 services

**Dashboard Changes Needed**:
```javascript
// Add dual endpoint support
const ENDPOINTS = {
  python: 'http://98.81.93.132:7777',
  typescript: 'https://dev.agents.visualforge.ai'
};

// Switch between endpoints for testing
const useTypescriptAgents = process.env.USE_NEW_AGENTS === 'true';
```

### **Phase 2: Migration (Next Week)**

**Objective**: Migrate all traffic to secure TypeScript agents

**Actions**:
1. Verify TypeScript agents pass all 18 service tests
2. Update dashboard to use only TypeScript endpoints
3. Migrate WebSocket chat to new port 7000
4. Add API key authentication to dashboard

**Security Integration**:
```javascript
// Add API key to all requests
const apiKey = process.env.NA_AGENTS_API_KEY;
headers: {
  'X-API-Key': apiKey,
  'Content-Type': 'application/json'
}
```

### **Phase 3: Retirement (Following Week)**

**Objective**: Shut down Python infrastructure

**Actions**:
1. Monitor TypeScript agents for 48+ hours
2. Verify all dashboard functionality works
3. Gracefully shut down Python agents
4. Remove old server references

## 🏗️ **Architecture Comparison**

### **Current (Python)**
```
Dashboard (localhost:5003) 
    ↓
98.81.93.132:7777 (Python API)
    ↓
[QA Agent] [Dev Agent] [Ops Agent]
    ↓
Tests 18 services across 2 projects
```

### **New (TypeScript)**
```
Dashboard (any domain)
    ↓ (HTTPS + API Key)
dev.agents.visualforge.ai (WAF Protected)
    ↓
[Architect:5001] [Developer:5002] [DevOps:5003] [QA:5004] [Manager:5005]
    ↓
Chat Interface (WebSocket :7000)
    ↓
Tests same 18 services + GitHub integration
```

## 🔧 **Technical Details**

### **TypeScript Agent Endpoints**
```bash
# Health checks
curl https://dev.agents.visualforge.ai:5001/health  # Architect
curl https://dev.agents.visualforge.ai:5002/health  # Developer  
curl https://dev.agents.visualforge.ai:5003/health  # DevOps
curl https://dev.agents.visualforge.ai:5004/health  # QA
curl https://dev.agents.visualforge.ai:5005/health  # Manager

# Task assignment
POST https://dev.agents.visualforge.ai:5001/agent/ai-architect-agent-1/task
Headers: X-API-Key: [secret]
Body: {"taskId": "test-123", "task": "Design system architecture"}

# Chat interface
WebSocket: wss://dev.agents.visualforge.ai:7000
```

### **Service Testing Migration**
The TypeScript QA agent will test the same 18 services:

**VisualForgeV2 (10 services)**:
- vf-dashboard-service → TypeScript QA agent
- vf-audio-service → TypeScript QA agent  
- vf-video-service → TypeScript QA agent
- vf-image-service → TypeScript QA agent
- vf-text-service → TypeScript QA agent
- vf-database-service → TypeScript QA agent
- vf-analytics-service → TypeScript QA agent
- vf-notification-service → TypeScript QA agent
- vf-payment-service → TypeScript QA agent
- vf-user-service → TypeScript QA agent

**NiroSubsV2 (8 services)**:
- nirosubs-auth-service → TypeScript QA agent
- nirosubs-payment-service → TypeScript QA agent
- nirosubs-user-management → TypeScript QA agent
- nirosubs-subscription-service → TypeScript QA agent
- nirosubs-content-service → TypeScript QA agent
- nirosubs-notification-service → TypeScript QA agent
- nirosubs-analytics-service → TypeScript QA agent
- nirosubs-billing-service → TypeScript QA agent

## 🔒 **Security Enhancements**

### **Added Protection**
- **WAF**: Rate limiting, SQL injection, XSS protection
- **API Keys**: Secure authentication for all endpoints
- **HTTPS**: All traffic encrypted (vs HTTP on 98.81.93.132)
- **CORS**: Restricted to dashboard domains only
- **Audit Logging**: All requests logged to CloudWatch

### **Dashboard Security Updates**
```javascript
// Environment-based configuration
const config = {
  apiKey: process.env.NA_AGENTS_API_KEY,
  baseUrl: 'https://dev.agents.visualforge.ai',
  enableSecurity: true,
  rateLimits: {
    requests: 100,
    windowMs: 15 * 60 * 1000 // 15 minutes
  }
};
```

## 📊 **Testing Plan**

### **Validation Tests**
1. **Parallel Testing**: Run same tests on both systems
2. **Performance**: Compare response times
3. **Reliability**: 24-hour uptime test
4. **Security**: Penetration testing on new endpoints
5. **Dashboard**: All UI features work with new API

### **Success Criteria**
- ✅ All 18 services tested successfully
- ✅ Dashboard connects to TypeScript agents
- ✅ Chat interface functional
- ✅ GitHub integration working
- ✅ Performance >= current system
- ✅ Zero security vulnerabilities

## 🚨 **Risk Mitigation**

### **Rollback Plan**
If TypeScript deployment fails:
1. Keep Python agents running (no downtime)
2. Dashboard falls back to 98.81.93.132
3. Debug TypeScript issues
4. Retry deployment when ready

### **Monitoring**
- ✅ CloudWatch alarms for both systems
- ✅ Dashboard health checks
- ✅ Agent response time monitoring
- ✅ Error rate tracking

## 📅 **Timeline**

### **Week 1 (Current)**
- [ ] Deploy TypeScript agents (in progress)
- [ ] DNS propagation complete
- [ ] Basic connectivity tests
- [ ] Dashboard dual-endpoint support

### **Week 2**
- [ ] Comprehensive testing against 18 services
- [ ] Security validation
- [ ] Performance benchmarking
- [ ] Dashboard migration

### **Week 3**
- [ ] Full migration to TypeScript
- [ ] Python agent retirement
- [ ] Documentation updates
- [ ] Team training

## 📋 **Action Items**

### **Immediate (Today)**
1. Complete DNS/security deployment
2. Test TypeScript agent connectivity
3. Update dashboard for dual endpoints
4. Run parallel tests

### **This Week**
1. Service integration testing
2. Security validation
3. Performance optimization
4. Dashboard migration

### **Next Week**
1. Full system migration
2. Python retirement
3. Documentation
4. Monitoring setup

---

## ✅ **Coordination Complete**

**Claude (Sonnet 4) is now responsible for**:
- NA-Agents TypeScript deployment
- Dashboard integration and migration  
- Security implementation
- Service testing coordination
- Python to TypeScript transition

**Handoff from Sonnet (Claude 3.5) includes**:
- Active server: 98.81.93.132
- Working dashboard on localhost:5003
- 18 services under active testing
- Monitoring infrastructure
- Clean codebase (deprecated instances removed)

**Next update**: Status report after DNS propagation and initial testing complete.

---
*Integration Plan Created: 2025-08-21*  
*Owner: Claude (Sonnet 4)*