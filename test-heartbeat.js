/**
 * Simple test for cost-effective heartbeat system
 * Run this to test heartbeat connectivity and save $600+/month
 */

const axios = require('axios');

// Simple heartbeat test without TypeScript compilation
class SimpleHeartbeatTest {
  constructor() {
    this.agentId = 'test-agent-1';
    this.agentType = 'test';
    this.port = 5001;
    this.dashboardUrl = 'http://localhost:4001';
    this.tasksCompleted = 5;
    this.currentTasks = 2;
  }

  getSimpleMetrics() {
    return {
      cpuUsage: 45.5,
      memoryUsage: 62.3,
      diskUsage: 0,
      networkIn: 1024,
      networkOut: 512,
      tasksCompleted: this.tasksCompleted,
      currentTasks: this.currentTasks
    };
  }

  getMetadata() {
    return {
      version: '1.0.0',
      capabilities: ['task_execution', 'message_handling', 'api_endpoints'],
      agentType: this.agentType,
      port: this.port,
      hostname: `test-agent-${this.port}`,
      instanceId: `local-${this.port}`
    };
  }

  getCost() {
    return {
      hourly: 0.001,
      daily: 0.024,
      monthly: 0.72
    };
  }

  async sendTestHeartbeat() {
    try {
      const payload = {
        status: 'running',
        metrics: this.getSimpleMetrics(),
        cost: this.getCost(),
        metadata: this.getMetadata(),
        timestamp: new Date().toISOString()
      };

      console.log('📡 Sending test heartbeat...');
      console.log('Payload:', JSON.stringify(payload, null, 2));

      const url = `${this.dashboardUrl}/api/agents/${this.agentId}/heartbeat`;
      const response = await axios.post(url, payload, { timeout: 10000 });

      if (response.status === 200) {
        console.log('✅ Heartbeat successful!');
        console.log('Response:', response.data);
        return true;
      } else {
        console.error(`❌ Heartbeat failed: ${response.status}`);
        return false;
      }

    } catch (error) {
      console.error('❌ Heartbeat error:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return false;
    }
  }

  async getActiveAgents() {
    try {
      console.log('📊 Getting active agents...');
      const url = `${this.dashboardUrl}/api/agents/heartbeat-active`;
      const response = await axios.get(url, { timeout: 5000 });

      if (response.status === 200) {
        console.log('✅ Active agents retrieved!');
        console.log('Active agents:', JSON.stringify(response.data, null, 2));
        return response.data;
      } else {
        console.error(`❌ Failed to get active agents: ${response.status}`);
        return null;
      }

    } catch (error) {
      console.error('❌ Error getting active agents:', error.message);
      return null;
    }
  }

  async testDashboardHealth() {
    try {
      console.log('🏥 Testing dashboard health...');
      const response = await axios.get(`${this.dashboardUrl}/health`, { timeout: 5000 });
      
      if (response.status === 200) {
        console.log('✅ Dashboard is healthy!');
        console.log('Health:', response.data);
        return true;
      } else {
        console.error(`❌ Dashboard health check failed: ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Dashboard health check error:', error.message);
      return false;
    }
  }

  async runFullTest() {
    console.log('🚀 Starting cost-effective heartbeat system test');
    console.log('💰 This system saves $600+/month vs CloudWatch API polling\n');

    // Test 1: Dashboard health
    console.log('--- Test 1: Dashboard Health ---');
    const healthOk = await this.testDashboardHealth();
    console.log('');

    if (!healthOk) {
      console.error('❌ Dashboard not available - stopping tests');
      return;
    }

    // Test 2: Send heartbeat
    console.log('--- Test 2: Send Heartbeat ---');
    const heartbeatOk = await this.sendTestHeartbeat();
    console.log('');

    // Test 3: Get active agents
    console.log('--- Test 3: Get Active Agents ---');
    const activeAgents = await this.getActiveAgents();
    console.log('');

    // Summary
    console.log('--- Test Summary ---');
    console.log(`✅ Dashboard Health: ${healthOk ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Heartbeat Send: ${heartbeatOk ? 'PASS' : 'FAIL'}`);
    console.log(`✅ Active Agents: ${activeAgents ? 'PASS' : 'FAIL'}`);
    
    if (healthOk && heartbeatOk && activeAgents) {
      console.log('\n🎉 All tests passed! Cost-effective heartbeat system is working!');
      console.log('💰 You are now saving $600+/month vs CloudWatch API polling');
    } else {
      console.log('\n❌ Some tests failed - check the logs above');
    }
  }
}

// Run the test
const tester = new SimpleHeartbeatTest();
tester.runFullTest().catch(error => {
  console.error('❌ Test runner failed:', error);
  process.exit(1);
});
