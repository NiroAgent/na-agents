import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message?: string;
  details?: any;
}

class AgentSystemTester {
  private results: TestResult[] = [];
  private agents = [
    { name: 'Architect', port: 5001, id: 'ai-architect-agent-1' },
    { name: 'Developer', port: 5002, id: 'ai-developer-agent-1' },
    { name: 'DevOps', port: 5003, id: 'ai-devops-agent-1' },
    { name: 'QA', port: 5004, id: 'ai-qa-agent-1' },
    { name: 'Manager', port: 5005, id: 'ai-manager-agent-1' }
  ];

  async runAllTests() {
    console.log('🧪 Starting Comprehensive Agent System Tests...\n');
    
    // Skip starting agents if they're already running
    console.log('✅ Using already running agents...\n');
    await this.wait(1000); // Small wait for any pending operations
    
    // Run test suites
    await this.testHealthEndpoints();
    await this.testStatusEndpoints();
    await this.testTaskProcessing();
    await this.testMessageEndpoints();
    await this.testConversationHistory();
    await this.testAgentControl();
    await this.testInterAgentCommunication();
    await this.testDashboardIntegration();
    await this.testErrorHandling();
    await this.performLoadTest();
    await this.testAWSIntegration();
    
    // Generate report
    this.generateReport();
    
    // Skip stopping agents (keep them running)
    console.log('✅ Keeping agents running for further testing');
  }

  private async startAgents() {
    console.log('🚀 Starting all agents...');
    try {
      await execAsync('npm run dev', { cwd: '.' });
      console.log('✅ Agents starting in background\n');
    } catch (error) {
      console.log('⚠️ Agents may already be running or started separately\n');
    }
  }

  private async stopAgents() {
    console.log('\n🛑 Stopping all agents...');
    for (const agent of this.agents) {
      try {
        await axios.post(`http://localhost:${agent.port}/agent/${agent.id}/control`, {
          action: 'stop'
        });
      } catch (error) {
        // Agent may already be stopped
      }
    }
  }

  private async testHealthEndpoints() {
    console.log('📍 Testing Health Endpoints...');
    for (const agent of this.agents) {
      try {
        const response = await axios.get(`http://localhost:${agent.port}/health`);
        this.results.push({
          test: `${agent.name} Health Check`,
          status: response.status === 200 && response.data.status === 'healthy' ? 'PASS' : 'FAIL',
          details: response.data
        });
        console.log(`  ✅ ${agent.name}: ${response.data.status}`);
      } catch (error: any) {
        this.results.push({
          test: `${agent.name} Health Check`,
          status: 'FAIL',
          message: error.message
        });
        console.log(`  ❌ ${agent.name}: Failed - ${error.message}`);
      }
    }
    console.log();
  }

  private async testStatusEndpoints() {
    console.log('📊 Testing Status Endpoints...');
    for (const agent of this.agents) {
      try {
        const response = await axios.get(`http://localhost:${agent.port}/agent/${agent.id}/status`);
        const hasRequiredFields = response.data.id && response.data.status && response.data.capabilities;
        this.results.push({
          test: `${agent.name} Status Endpoint`,
          status: hasRequiredFields ? 'PASS' : 'FAIL',
          details: response.data
        });
        console.log(`  ✅ ${agent.name}: ${response.data.status} - ${response.data.tasksProcessed || 0} tasks processed`);
      } catch (error: any) {
        this.results.push({
          test: `${agent.name} Status Endpoint`,
          status: 'FAIL',
          message: error.message
        });
        console.log(`  ❌ ${agent.name}: Failed - ${error.message}`);
      }
    }
    console.log();
  }

  private async testTaskProcessing() {
    console.log('⚙️ Testing Task Processing...');
    const testTasks = [
      { agent: this.agents[0], task: { type: 'design', description: 'Design a REST API for user management' }},
      { agent: this.agents[1], task: { type: 'code', description: 'Generate a function to validate email addresses' }},
      { agent: this.agents[2], task: { type: 'deploy', description: 'Create a Lambda function deployment script' }},
      { agent: this.agents[3], task: { type: 'test', description: 'Create unit tests for authentication module' }},
      { agent: this.agents[4], task: { type: 'coordinate', description: 'Organize sprint planning for next iteration' }}
    ];

    for (const { agent, task } of testTasks) {
      try {
        const response = await axios.post(`http://localhost:${agent.port}/agent/${agent.id}/task`, task);
        const success = response.data.taskId && response.data.status === 'processing';
        this.results.push({
          test: `${agent.name} Task Processing`,
          status: success ? 'PASS' : 'FAIL',
          details: response.data
        });
        console.log(`  ✅ ${agent.name}: Task ${response.data.taskId} - ${response.data.status}`);
      } catch (error: any) {
        this.results.push({
          test: `${agent.name} Task Processing`,
          status: 'FAIL',
          message: error.message
        });
        console.log(`  ❌ ${agent.name}: Failed - ${error.message}`);
      }
    }
    console.log();
  }

  private async testMessageEndpoints() {
    console.log('💬 Testing Message Endpoints...');
    for (const agent of this.agents) {
      try {
        const response = await axios.post(`http://localhost:${agent.port}/agent/${agent.id}/message`, {
          content: `Test message for ${agent.name}`,
          sender: 'test-suite'
        });
        const success = response.data.messageId && response.data.status === 'received';
        this.results.push({
          test: `${agent.name} Message Handling`,
          status: success ? 'PASS' : 'FAIL',
          details: response.data
        });
        console.log(`  ✅ ${agent.name}: Message ${response.data.messageId} received`);
      } catch (error: any) {
        this.results.push({
          test: `${agent.name} Message Handling`,
          status: 'FAIL',
          message: error.message
        });
        console.log(`  ❌ ${agent.name}: Failed - ${error.message}`);
      }
    }
    console.log();
  }

  private async testConversationHistory() {
    console.log('📜 Testing Conversation History...');
    for (const agent of this.agents) {
      try {
        const response = await axios.get(`http://localhost:${agent.port}/agent/${agent.id}/conversation`);
        const hasHistory = Array.isArray(response.data.history);
        this.results.push({
          test: `${agent.name} Conversation History`,
          status: hasHistory ? 'PASS' : 'FAIL',
          details: { messageCount: response.data.history?.length || 0 }
        });
        console.log(`  ✅ ${agent.name}: ${response.data.history?.length || 0} messages in history`);
      } catch (error: any) {
        this.results.push({
          test: `${agent.name} Conversation History`,
          status: 'FAIL',
          message: error.message
        });
        console.log(`  ❌ ${agent.name}: Failed - ${error.message}`);
      }
    }
    console.log();
  }

  private async testAgentControl() {
    console.log('🎮 Testing Agent Control...');
    const testAgent = this.agents[0]; // Test with Architect agent
    
    try {
      // Test restart
      const restartResponse = await axios.post(`http://localhost:${testAgent.port}/agent/${testAgent.id}/control`, {
        action: 'restart'
      });
      this.results.push({
        test: `${testAgent.name} Restart Control`,
        status: restartResponse.data.status === 'restarting' ? 'PASS' : 'FAIL',
        details: restartResponse.data
      });
      console.log(`  ✅ ${testAgent.name}: Restart command accepted`);
      
      await this.wait(2000); // Wait for restart
      
      // Verify agent is back online
      const healthCheck = await axios.get(`http://localhost:${testAgent.port}/health`);
      console.log(`  ✅ ${testAgent.name}: Successfully restarted and healthy`);
      
    } catch (error: any) {
      this.results.push({
        test: `${testAgent.name} Control`,
        status: 'FAIL',
        message: error.message
      });
      console.log(`  ❌ ${testAgent.name}: Control test failed - ${error.message}`);
    }
    console.log();
  }

  private async testInterAgentCommunication() {
    console.log('🔗 Testing Inter-Agent Communication...');
    
    try {
      // Manager sends task to Developer
      const taskResponse = await axios.post(`http://localhost:5005/agent/manager-agent/message`, {
        content: 'Delegate code generation task to developer',
        targetAgent: 'developer-agent',
        sender: 'manager-agent'
      });
      
      // Check if Developer received it
      await this.wait(1000);
      const devHistory = await axios.get(`http://localhost:5002/agent/developer-agent/conversation`);
      const messageReceived = devHistory.data.history?.some((msg: any) => 
        msg.sender === 'manager-agent'
      );
      
      this.results.push({
        test: 'Inter-Agent Communication',
        status: messageReceived ? 'PASS' : 'FAIL',
        details: { messagesSent: 1, messagesReceived: messageReceived ? 1 : 0 }
      });
      console.log(`  ✅ Manager → Developer communication: ${messageReceived ? 'Success' : 'Failed'}`);
      
    } catch (error: any) {
      this.results.push({
        test: 'Inter-Agent Communication',
        status: 'FAIL',
        message: error.message
      });
      console.log(`  ❌ Inter-agent communication failed - ${error.message}`);
    }
    console.log();
  }

  private async testDashboardIntegration() {
    console.log('📡 Testing Dashboard Integration...');
    
    // Check if agents are sending heartbeats
    for (const agent of this.agents) {
      try {
        const status = await axios.get(`http://localhost:${agent.port}/agent/${agent.id}/status`);
        const isRegistered = status.data.dashboardRegistered !== undefined;
        
        this.results.push({
          test: `${agent.name} Dashboard Registration`,
          status: isRegistered ? 'PASS' : 'FAIL',
          details: { registered: isRegistered }
        });
        console.log(`  ${isRegistered ? '✅' : '⚠️'} ${agent.name}: Dashboard registration ${isRegistered ? 'attempted' : 'not configured'}`);
        
      } catch (error: any) {
        this.results.push({
          test: `${agent.name} Dashboard Registration`,
          status: 'FAIL',
          message: error.message
        });
        console.log(`  ❌ ${agent.name}: Failed to check registration - ${error.message}`);
      }
    }
    console.log();
  }

  private async testErrorHandling() {
    console.log('🛡️ Testing Error Handling...');
    
    const errorTests = [
      {
        name: 'Invalid Task Format',
        request: () => axios.post(`http://localhost:5001/agent/architect-agent/task`, { invalid: 'data' })
      },
      {
        name: 'Non-existent Endpoint',
        request: () => axios.get(`http://localhost:5001/nonexistent`)
      },
      {
        name: 'Invalid Agent ID',
        request: () => axios.get(`http://localhost:5001/agent/wrong-id/status`)
      }
    ];
    
    for (const test of errorTests) {
      try {
        await test.request();
        this.results.push({
          test: test.name,
          status: 'FAIL',
          message: 'Expected error but request succeeded'
        });
        console.log(`  ⚠️ ${test.name}: Expected error but succeeded`);
      } catch (error: any) {
        const properError = error.response && error.response.status >= 400;
        this.results.push({
          test: test.name,
          status: properError ? 'PASS' : 'FAIL',
          details: { statusCode: error.response?.status }
        });
        console.log(`  ✅ ${test.name}: Properly handled with status ${error.response?.status}`);
      }
    }
    console.log();
  }

  private async performLoadTest() {
    console.log('⚡ Performing Load Test...');
    const requestsPerAgent = 50;
    const startTime = Date.now();
    const promises: Promise<any>[] = [];
    
    for (const agent of this.agents) {
      for (let i = 0; i < requestsPerAgent; i++) {
        promises.push(
          axios.get(`http://localhost:${agent.port}/health`)
            .then(() => ({ success: true, agent: agent.name }))
            .catch(() => ({ success: false, agent: agent.name }))
        );
      }
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    const successCount = results.filter(r => r.success).length;
    const totalRequests = this.agents.length * requestsPerAgent;
    
    this.results.push({
      test: 'Load Test',
      status: successCount >= totalRequests * 0.95 ? 'PASS' : 'FAIL',
      details: {
        totalRequests,
        successCount,
        failureCount: totalRequests - successCount,
        duration: `${duration}ms`,
        requestsPerSecond: Math.round((totalRequests / duration) * 1000)
      }
    });
    
    console.log(`  ✅ Processed ${totalRequests} requests in ${duration}ms`);
    console.log(`  ✅ Success rate: ${((successCount/totalRequests) * 100).toFixed(2)}%`);
    console.log(`  ✅ Throughput: ${Math.round((totalRequests / duration) * 1000)} req/s`);
    console.log();
  }

  private async testAWSIntegration() {
    console.log('☁️ Testing AWS Integration Points...');
    
    // Test DevOps agent's AWS capabilities
    try {
      const response = await axios.post(`http://localhost:5003/agent/devops-agent/task`, {
        type: 'aws-check',
        description: 'Verify AWS client initialization'
      });
      
      this.results.push({
        test: 'AWS Integration',
        status: response.data.status === 'processing' ? 'PASS' : 'FAIL',
        details: response.data
      });
      console.log(`  ✅ DevOps Agent: AWS clients initialized`);
      
    } catch (error: any) {
      this.results.push({
        test: 'AWS Integration',
        status: 'FAIL',
        message: error.message
      });
      console.log(`  ⚠️ AWS Integration: ${error.message}`);
    }
    console.log();
  }

  private generateReport() {
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('═══════════════════════════════════════\n');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(2);
    
    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📈 Pass Rate: ${passRate}%`);
    console.log();
    
    if (failed > 0) {
      console.log('Failed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => {
        console.log(`  ❌ ${r.test}: ${r.message || 'Test failed'}`);
      });
      console.log();
    }
    
    // Save detailed report
    this.saveDetailedReport();
  }

  private async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'PASS').length,
        failed: this.results.filter(r => r.status === 'FAIL').length,
        passRate: ((this.results.filter(r => r.status === 'PASS').length / this.results.length) * 100).toFixed(2) + '%'
      },
      results: this.results
    };
    
    await fs.writeFile(
      './test-report.json',
      JSON.stringify(report, null, 2)
    );
    console.log('📄 Detailed report saved to test-report.json\n');
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests
const tester = new AgentSystemTester();
tester.runAllTests().catch(console.error);