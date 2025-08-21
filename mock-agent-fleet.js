const http = require('http');

class MockAgent {
    constructor(id, type, dashboardUrl = 'http://98.81.93.132:7777') {
        this.id = id;
        this.type = type;
        this.dashboardUrl = dashboardUrl;
        this.status = 'active';
        this.startTime = Date.now();
        this.taskCount = 0;
        this.heartbeatInterval = 15000; // 15 seconds
        
        console.log(`🚀 Starting agent: ${this.id} (${this.type})`);
        this.startHeartbeat();
    }
    
    generateMetrics() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        return {
            id: this.id,
            name: this.id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type: this.type,
            status: this.getRandomStatus(),
            cpuUsage: Math.floor(Math.random() * 100),
            memoryUsage: Math.floor(Math.random() * 100),
            taskCount: this.taskCount,
            uptime: uptime,
            lastHeartbeat: new Date().toISOString(),
            successRate: Math.floor(Math.random() * 40) + 60 // 60-100%
        };
    }
    
    getRandomStatus() {
        const statuses = ['active', 'idle', 'busy'];
        if (Math.random() < 0.8) return 'active'; // 80% chance active
        return statuses[Math.floor(Math.random() * statuses.length)];
    }
    
    async reportToAPI() {
        const metrics = this.generateMetrics();
        
        // For now, just log the metrics since our API is read-only
        // In a real system, this would POST to /api/agents
        console.log(`📊 Agent ${this.id}: Status=${metrics.status}, CPU=${metrics.cpuUsage}%, Tasks=${metrics.taskCount}`);
        
        // Simulate task completion
        if (Math.random() < 0.3) {
            this.taskCount++;
        }
    }
    
    startHeartbeat() {
        console.log(`💓 Starting heartbeat for ${this.id} every ${this.heartbeatInterval/1000}s`);
        
        // Initial report
        this.reportToAPI();
        
        // Set up interval
        this.heartbeatTimer = setInterval(() => {
            this.reportToAPI();
        }, this.heartbeatInterval);
    }
    
    stop() {
        console.log(`🛑 Stopping agent: ${this.id}`);
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }
    }
}

// Create a fleet of agents
const agents = [];

function startAgentFleet() {
    console.log('🚀 Starting AI Agent Fleet...');
    
    // Create different types of agents
    const agentConfigs = [
        { id: 'ai-architect-001', type: 'architect' },
        { id: 'ai-architect-002', type: 'architect' },
        { id: 'ai-developer-001', type: 'developer' },
        { id: 'ai-developer-002', type: 'developer' },
        { id: 'ai-developer-003', type: 'developer' },
        { id: 'ai-developer-004', type: 'developer' },
        { id: 'ai-devops-001', type: 'devops' },
        { id: 'ai-devops-002', type: 'devops' },
        { id: 'ai-qa-001', type: 'qa' },
        { id: 'ai-qa-002', type: 'qa' },
        { id: 'ai-manager-001', type: 'manager' },
        { id: 'ai-security-001', type: 'security' },
        { id: 'ai-data-001', type: 'data-engineer' },
        { id: 'ai-ui-001', type: 'ui-designer' },
        { id: 'ai-product-001', type: 'product-manager' }
    ];
    
    // Start agents with staggered startup
    agentConfigs.forEach((config, index) => {
        setTimeout(() => {
            const agent = new MockAgent(config.id, config.type);
            agents.push(agent);
        }, index * 1000); // 1 second delay between starts
    });
    
    console.log(`✅ Starting ${agentConfigs.length} agents...`);
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down agent fleet...');
    agents.forEach(agent => agent.stop());
    process.exit(0);
});

// Start the fleet
startAgentFleet();

console.log('🌐 View dashboard at: http://niro-agent-dashboard-dev-816454053517.s3-website-us-east-1.amazonaws.com');
console.log('📊 API endpoint: http://98.81.93.132:7777/api/agents');
console.log('Press Ctrl+C to stop all agents');
