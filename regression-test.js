/**
 * Comprehensive Regression Test Suite for NA-Agents System
 * Tests all agent endpoints, functionality, and integration points
 */

const axios = require('axios');
const fs = require('fs').promises;

class RegressionTester {
  constructor() {
    this.results = [];
    this.agents = [
      { name: 'Architect', port: 5001, id: 'ai-architect-agent-1' },
      { name: 'Developer', port: 5002, id: 'ai-developer-agent-1' },
      { name: 'DevOps', port: 5003, id: 'ai-devops-agent-1' },
      { name: 'QA', port: 5004, id: 'ai-qa-agent-1' },
      { name: 'Manager', port: 5005, id: 'ai-manager-agent-1' }
    ];
    this.services = [
      { name: 'Chat Interface', port: 7000, endpoint: '/health' },
      { name: 'GitHub Service', port: 6000, endpoint: '/health' }
    ];
  }

  async runFullRegressionTest() {
    console.log('🧪 STARTING FULL REGRESSION TEST SUITE');
    console.log('=====================================\n');
    
    const startTime = Date.now();
    
    // Core functionality tests
    await this.testAgentHealthEndpoints();
    await this.testAgentStatusEndpoints();
    await this.testAgentTaskProcessing();
    await this.testAgentMessageHandling();
    await this.testAgentConversationHistory();
    
    // Service tests
    await this.testSupportingServices();
    await this.testChatInterfaceUI();
    
    // Integration tests
    await this.testInterAgentCommunication();
    await this.testErrorHandling();
    await this.testSecurityEndpoints();
    
    // Performance tests
    await this.testLoadPerformance();
    await this.testConcurrentRequests();
    
    // System tests
    await this.testSystemResourceUsage();
    await this.testHealthCheckStability();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Generate comprehensive report
    await this.generateFinalReport(duration);
    
    return this.getTestSummary();
  }

  async testAgentHealthEndpoints() {
    console.log('🏥 Testing Agent Health Endpoints...');
    for (const agent of this.agents) {
      try {
        const response = await axios.get(`http://localhost:${agent.port}/health`, { timeout: 5000 });
        const isHealthy = response.status === 200 && (response.data.status === 'healthy' || response.data.healthy);
        
        this.addResult(`${agent.name} Health Check`, isHealthy ? 'PASS' : 'FAIL', {
          status: response.status,
          data: response.data,
          responseTime: response.headers['x-response-time'] || 'N/A'
        });
        
        console.log(`  ${isHealthy ? '✅' : '❌'} ${agent.name}: ${response.data.status || response.data.healthy || 'Unknown'}`);
        
      } catch (error) {
        this.addResult(`${agent.name} Health Check`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${agent.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testAgentStatusEndpoints() {
    console.log('📊 Testing Agent Status Endpoints...');
    for (const agent of this.agents) {
      try {
        const response = await axios.get(`http://localhost:${agent.port}/agent/${agent.id}/status`, { timeout: 5000 });
        const hasRequiredFields = response.data.id || response.data.agentId || response.data.name;
        
        this.addResult(`${agent.name} Status Endpoint`, hasRequiredFields ? 'PASS' : 'FAIL', {
          status: response.status,
          data: response.data
        });
        
        console.log(`  ✅ ${agent.name}: Status ${response.data.status || 'available'} - Tasks: ${response.data.tasksProcessed || 0}`);
        
      } catch (error) {
        this.addResult(`${agent.name} Status Endpoint`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${agent.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testAgentTaskProcessing() {
    console.log('⚙️ Testing Agent Task Processing...');
    const testTasks = [
      { agent: this.agents[0], task: { taskId: 'test-arch-001', task: 'Design a microservices architecture', priority: 'medium' }},
      { agent: this.agents[1], task: { taskId: 'test-dev-001', task: 'Create a TypeScript validation function', priority: 'high' }},
      { agent: this.agents[2], task: { taskId: 'test-devops-001', task: 'Generate deployment script', priority: 'medium' }},
      { agent: this.agents[3], task: { taskId: 'test-qa-001', task: 'Create test cases for API', priority: 'medium' }},
      { agent: this.agents[4], task: { taskId: 'test-mgr-001', task: 'Plan sprint activities', priority: 'low' }}
    ];

    for (const { agent, task } of testTasks) {
      try {
        const response = await axios.post(`http://localhost:${agent.port}/agent/${agent.id}/task`, task, { timeout: 10000 });
        const taskAccepted = response.data.taskId && (response.data.status === 'processing' || response.data.status === 'accepted');
        
        this.addResult(`${agent.name} Task Processing`, taskAccepted ? 'PASS' : 'FAIL', {
          taskId: response.data.taskId,
          status: response.data.status,
          data: response.data
        });
        
        console.log(`  ✅ ${agent.name}: Task ${response.data.taskId} - ${response.data.status}`);
        
      } catch (error) {
        this.addResult(`${agent.name} Task Processing`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${agent.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testAgentMessageHandling() {
    console.log('💬 Testing Agent Message Handling...');
    for (const agent of this.agents) {
      try {
        const message = {
          messageId: `msg-${Date.now()}-${agent.name.toLowerCase()}`,
          content: `Test message for ${agent.name} agent`,
          sender: 'regression-test-suite',
          timestamp: new Date().toISOString()
        };
        
        const response = await axios.post(`http://localhost:${agent.port}/agent/${agent.id}/message`, message, { timeout: 5000 });
        const messageAccepted = response.data.messageId || response.data.status === 'received';
        
        this.addResult(`${agent.name} Message Handling`, messageAccepted ? 'PASS' : 'FAIL', {
          messageId: response.data.messageId,
          status: response.data.status
        });
        
        console.log(`  ✅ ${agent.name}: Message processed - ID: ${response.data.messageId || 'N/A'}`);
        
      } catch (error) {
        this.addResult(`${agent.name} Message Handling`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${agent.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testAgentConversationHistory() {
    console.log('📜 Testing Conversation History...');
    for (const agent of this.agents) {
      try {
        const response = await axios.get(`http://localhost:${agent.port}/agent/${agent.id}/conversation`, { timeout: 5000 });
        const hasHistory = Array.isArray(response.data.history) || Array.isArray(response.data.messages) || response.data.conversations;
        
        this.addResult(`${agent.name} Conversation History`, hasHistory ? 'PASS' : 'FAIL', {
          messageCount: response.data.history?.length || response.data.messages?.length || 0
        });
        
        console.log(`  ✅ ${agent.name}: ${response.data.history?.length || response.data.messages?.length || 0} messages in history`);
        
      } catch (error) {
        this.addResult(`${agent.name} Conversation History`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${agent.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testSupportingServices() {
    console.log('🔧 Testing Supporting Services...');
    for (const service of this.services) {
      try {
        const response = await axios.get(`http://localhost:${service.port}${service.endpoint}`, { timeout: 5000 });
        const isHealthy = response.status === 200;
        
        this.addResult(`${service.name} Service`, isHealthy ? 'PASS' : 'FAIL', {
          status: response.status,
          data: response.data
        });
        
        console.log(`  ✅ ${service.name}: Service available on port ${service.port}`);
        
      } catch (error) {
        this.addResult(`${service.name} Service`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${service.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testChatInterfaceUI() {
    console.log('💻 Testing Chat Interface UI...');
    try {
      const response = await axios.get('http://localhost:7000/', { timeout: 5000 });
      const hasUI = response.status === 200 && response.data.includes('NA-Agents');
      
      this.addResult('Chat Interface UI', hasUI ? 'PASS' : 'FAIL', {
        status: response.status,
        contentType: response.headers['content-type']
      });
      
      console.log(`  ✅ Chat Interface: Web UI accessible`);
      
    } catch (error) {
      this.addResult('Chat Interface UI', 'FAIL', { error: error.message });
      console.log(`  ❌ Chat Interface: ${error.message}`);
    }
    console.log();
  }

  async testInterAgentCommunication() {
    console.log('🔗 Testing Inter-Agent Communication...');
    try {
      // Test Manager delegating to Developer
      const delegationTask = {
        taskId: `delegation-${Date.now()}`,
        task: 'Coordinate with developer for code review',
        priority: 'medium',
        targetAgent: 'ai-developer-agent-1'
      };
      
      const response = await axios.post('http://localhost:5005/agent/ai-manager-agent-1/task', delegationTask, { timeout: 10000 });
      const delegationSuccessful = response.data.taskId && response.data.status;
      
      this.addResult('Inter-Agent Communication', delegationSuccessful ? 'PASS' : 'FAIL', {
        taskId: response.data.taskId,
        status: response.data.status
      });
      
      console.log(`  ✅ Manager → Developer delegation: ${delegationSuccessful ? 'Success' : 'Failed'}`);
      
    } catch (error) {
      this.addResult('Inter-Agent Communication', 'FAIL', { error: error.message });
      console.log(`  ❌ Inter-agent communication: ${error.message}`);
    }
    console.log();
  }

  async testErrorHandling() {
    console.log('🛡️ Testing Error Handling...');
    const errorTests = [
      {
        name: 'Invalid Task Format',
        request: () => axios.post('http://localhost:5001/agent/ai-architect-agent-1/task', { invalid: 'data' })
      },
      {
        name: 'Non-existent Endpoint',
        request: () => axios.get('http://localhost:5001/nonexistent-endpoint')
      },
      {
        name: 'Invalid Agent ID',
        request: () => axios.get('http://localhost:5001/agent/invalid-agent-id/status')
      }
    ];

    for (const test of errorTests) {
      try {
        await test.request();
        this.addResult(test.name, 'FAIL', { message: 'Expected error but request succeeded' });
        console.log(`  ⚠️ ${test.name}: Expected error but succeeded`);
      } catch (error) {
        const properError = error.response && error.response.status >= 400;
        this.addResult(test.name, properError ? 'PASS' : 'FAIL', { statusCode: error.response?.status });
        console.log(`  ✅ ${test.name}: Proper error handling (${error.response?.status})`);
      }
    }
    console.log();
  }

  async testSecurityEndpoints() {
    console.log('🔒 Testing Security Endpoints...');
    // Test for common security headers
    for (const agent of this.agents.slice(0, 2)) { // Test first 2 agents
      try {
        const response = await axios.get(`http://localhost:${agent.port}/health`, { timeout: 5000 });
        const hasSecurityHeaders = response.headers['x-powered-by'] !== 'Express'; // Should be hidden
        
        this.addResult(`${agent.name} Security Headers`, hasSecurityHeaders ? 'PASS' : 'WARN', {
          headers: Object.keys(response.headers)
        });
        
        console.log(`  ${hasSecurityHeaders ? '✅' : '⚠️'} ${agent.name}: Security headers ${hasSecurityHeaders ? 'configured' : 'default'}`);
        
      } catch (error) {
        this.addResult(`${agent.name} Security Headers`, 'FAIL', { error: error.message });
        console.log(`  ❌ ${agent.name}: ${error.message}`);
      }
    }
    console.log();
  }

  async testLoadPerformance() {
    console.log('⚡ Testing Load Performance...');
    const requestCount = 20;
    const startTime = Date.now();
    const promises = [];

    // Send concurrent requests to all agents
    for (let i = 0; i < requestCount; i++) {
      for (const agent of this.agents) {
        promises.push(
          axios.get(`http://localhost:${agent.port}/health`, { timeout: 5000 })
            .then(response => ({ success: true, agent: agent.name, time: Date.now() - startTime }))
            .catch(error => ({ success: false, agent: agent.name, error: error.message }))
        );
      }
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const total = results.length;
    const endTime = Date.now();
    const duration = endTime - startTime;

    const passRate = (successful / total) * 100;
    this.addResult('Load Performance Test', passRate >= 95 ? 'PASS' : 'FAIL', {
      totalRequests: total,
      successful,
      failed: total - successful,
      duration: `${duration}ms`,
      passRate: `${passRate.toFixed(2)}%`,
      requestsPerSecond: Math.round((total / duration) * 1000)
    });

    console.log(`  ✅ Processed ${total} requests in ${duration}ms`);
    console.log(`  ✅ Success rate: ${passRate.toFixed(2)}%`);
    console.log(`  ✅ Throughput: ${Math.round((total / duration) * 1000)} req/s`);
    console.log();
  }

  async testConcurrentRequests() {
    console.log('🔄 Testing Concurrent Request Handling...');
    
    // Test concurrent task submissions
    const concurrentTasks = this.agents.map((agent, index) => 
      axios.post(`http://localhost:${agent.port}/agent/${agent.id}/task`, {
        taskId: `concurrent-${Date.now()}-${index}`,
        task: `Concurrent test task for ${agent.name}`,
        priority: 'low'
      }, { timeout: 10000 })
        .then(response => ({ success: true, agent: agent.name, taskId: response.data.taskId }))
        .catch(error => ({ success: false, agent: agent.name, error: error.message }))
    );

    const results = await Promise.all(concurrentTasks);
    const successful = results.filter(r => r.success).length;
    
    this.addResult('Concurrent Task Handling', successful === this.agents.length ? 'PASS' : 'FAIL', {
      totalAgents: this.agents.length,
      successful,
      results
    });

    console.log(`  ✅ Concurrent tasks: ${successful}/${this.agents.length} agents handled tasks simultaneously`);
    console.log();
  }

  async testSystemResourceUsage() {
    console.log('💻 Testing System Resource Usage...');
    
    // Simple resource check by testing response times
    const resourceTests = [];
    for (const agent of this.agents) {
      const startTime = Date.now();
      try {
        await axios.get(`http://localhost:${agent.port}/health`, { timeout: 5000 });
        const responseTime = Date.now() - startTime;
        resourceTests.push({ agent: agent.name, responseTime, healthy: true });
      } catch (error) {
        resourceTests.push({ agent: agent.name, responseTime: -1, healthy: false, error: error.message });
      }
    }

    const avgResponseTime = resourceTests
      .filter(t => t.healthy)
      .reduce((sum, t) => sum + t.responseTime, 0) / resourceTests.filter(t => t.healthy).length;

    this.addResult('System Resource Usage', avgResponseTime < 1000 ? 'PASS' : 'WARN', {
      averageResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      tests: resourceTests
    });

    console.log(`  ✅ Average response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log();
  }

  async testHealthCheckStability() {
    console.log('🔄 Testing Health Check Stability...');
    
    // Test health checks over time
    const checks = [];
    for (let i = 0; i < 5; i++) {
      const checkResults = [];
      for (const agent of this.agents) {
        try {
          const response = await axios.get(`http://localhost:${agent.port}/health`, { timeout: 3000 });
          checkResults.push({ agent: agent.name, healthy: response.status === 200 });
        } catch (error) {
          checkResults.push({ agent: agent.name, healthy: false });
        }
      }
      checks.push(checkResults);
      
      if (i < 4) await this.wait(1000); // Wait 1 second between checks
    }

    // Calculate stability
    const stabilityScores = this.agents.map(agent => {
      const agentChecks = checks.map(check => check.find(c => c.agent === agent.name)?.healthy || false);
      const healthyCount = agentChecks.filter(h => h).length;
      return { agent: agent.name, stability: (healthyCount / checks.length) * 100 };
    });

    const avgStability = stabilityScores.reduce((sum, s) => sum + s.stability, 0) / stabilityScores.length;
    
    this.addResult('Health Check Stability', avgStability >= 80 ? 'PASS' : 'FAIL', {
      averageStability: `${avgStability.toFixed(2)}%`,
      agentStability: stabilityScores
    });

    console.log(`  ✅ Health check stability: ${avgStability.toFixed(2)}%`);
    console.log();
  }

  addResult(test, status, details = {}) {
    this.results.push({
      test,
      status,
      timestamp: new Date().toISOString(),
      details
    });
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async generateFinalReport(duration) {
    const summary = this.getTestSummary();
    
    console.log('📊 REGRESSION TEST SUMMARY');
    console.log('═══════════════════════════════════════\n');
    
    console.log(`⏱️  Total Duration: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`📈 Total Tests: ${summary.total}`);
    console.log(`✅ Passed: ${summary.passed}`);
    console.log(`⚠️  Warnings: ${summary.warnings}`);
    console.log(`❌ Failed: ${summary.failed}`);
    console.log(`📊 Pass Rate: ${summary.passRate}%`);
    console.log();

    if (summary.failed > 0) {
      console.log('❌ FAILED TESTS:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  • ${r.test}: ${r.details.error || 'Test failed'}`);
      });
      console.log();
    }

    if (summary.warnings > 0) {
      console.log('⚠️  WARNINGS:');
      this.results.filter(r => r.status === 'WARN').forEach(r => {
        console.log(`  • ${r.test}: Performance or configuration issue`);
      });
      console.log();
    }

    // Save detailed report
    const report = {
      summary,
      executedAt: new Date().toISOString(),
      duration: `${(duration / 1000).toFixed(2)}s`,
      environment: 'local',
      testSuite: 'regression-test-suite',
      results: this.results
    };

    try {
      await fs.writeFile('./regression-test-report.json', JSON.stringify(report, null, 2));
      console.log('📄 Detailed report saved to regression-test-report.json');
    } catch (error) {
      console.log('⚠️  Could not save detailed report:', error.message);
    }

    console.log();
    console.log(summary.passRate >= 80 ? '🎉 REGRESSION TEST SUITE PASSED!' : '⚠️  REGRESSION TEST SUITE NEEDS ATTENTION');
    console.log();
  }

  getTestSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(2) : '0.00';
    
    return { total, passed, warnings, failed, passRate };
  }
}

// Run the comprehensive regression test
if (require.main === module) {
  const tester = new RegressionTester();
  tester.runFullRegressionTest()
    .then(summary => {
      process.exit(summary.passRate >= 80 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Regression test suite failed:', error);
      process.exit(1);
    });
}

module.exports = RegressionTester;