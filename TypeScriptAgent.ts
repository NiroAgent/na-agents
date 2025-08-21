/**
 * Example TypeScript Agent using Cost-Effective Heartbeat
 * Saves $600+/month vs CloudWatch API polling
 */

import express from 'express';
import { CostEffectiveHeartbeat } from './CostEffectiveHeartbeat.js';

interface Task {
  id: string;
  type: string;
  payload: any;
  priority: number;
  createdAt: Date;
}

class TypeScriptAgent {
  private app: express.Application;
  private port: number;
  private agentId: string;
  private agentType: string;
  private heartbeat: CostEffectiveHeartbeat;
  private taskQueue: Task[] = [];
  private isProcessing: boolean = false;

  constructor(agentId: string, agentType: string, port: number) {
    this.agentId = agentId;
    this.agentType = agentType;
    this.port = port;
    this.app = express();
    this.app.use(express.json());

    // Initialize cost-effective heartbeat
    this.heartbeat = new CostEffectiveHeartbeat({
      agentId: this.agentId,
      agentType: this.agentType,
      port: this.port,
      dashboardUrl: 'http://localhost:4001',
      heartbeatInterval: 30000 // 30 seconds
    });

    this.setupRoutes();
    console.log(`🤖 ${this.agentType} (${this.agentId}) initializing on port ${this.port}`);
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        agentId: this.agentId,
        type: this.agentType,
        queueSize: this.taskQueue.length,
        processing: this.isProcessing,
        timestamp: new Date().toISOString()
      });
    });

    // Task assignment endpoint
    this.app.post('/tasks', (req, res) => {
      const task: Task = {
        id: req.body.id || `task-${Date.now()}`,
        type: req.body.type || 'generic',
        payload: req.body.payload || {},
        priority: req.body.priority || 1,
        createdAt: new Date()
      };

      this.taskQueue.push(task);
      this.heartbeat.updateTaskMetrics(false, true, false); // Task started

      console.log(`📋 New task received: ${task.id} (type: ${task.type})`);
      console.log(`📊 Queue size: ${this.taskQueue.length}`);

      res.json({ 
        success: true, 
        taskId: task.id,
        queuePosition: this.taskQueue.length,
        estimatedWaitTime: this.taskQueue.length * 2 // 2 seconds per task estimate
      });

      // Process tasks asynchronously
      this.processTaskQueue();
    });

    // Agent status endpoint
    this.app.get('/status', (req, res) => {
      const metrics = this.heartbeat.getCurrentMetrics();
      res.json({
        agentId: this.agentId,
        type: this.agentType,
        status: this.isProcessing ? 'busy' : 'idle',
        metrics: metrics,
        queueSize: this.taskQueue.length,
        uptime: process.uptime?.() || 0,
        memoryUsage: process.memoryUsage?.() || {},
        timestamp: new Date().toISOString()
      });
    });

    // Task queue status
    this.app.get('/queue', (req, res) => {
      res.json({
        queueSize: this.taskQueue.length,
        tasks: this.taskQueue.map(task => ({
          id: task.id,
          type: task.type,
          priority: task.priority,
          waitTime: Date.now() - task.createdAt.getTime()
        })),
        processing: this.isProcessing
      });
    });
  }

  private async processTaskQueue(): Promise<void> {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`🔄 Processing task queue (${this.taskQueue.length} tasks)`);

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (!task) break;

      console.log(`⚡ Processing task: ${task.id} (${task.type})`);
      
      try {
        // Simulate task processing
        await this.processTask(task);
        
        // Update metrics - task completed
        this.heartbeat.updateTaskMetrics(true, false, true);
        
        console.log(`✅ Task completed: ${task.id}`);
        
      } catch (error) {
        console.error(`❌ Task failed: ${task.id}`, error);
        this.heartbeat.updateTaskMetrics(false, false, true);
      }

      // Small delay between tasks
      await this.delay(1000);
    }

    this.isProcessing = false;
    console.log(`🏁 Task queue processing complete`);
  }

  private async processTask(task: Task): Promise<void> {
    // Simulate different types of tasks
    switch (task.type) {
      case 'data_analysis':
        await this.delay(2000 + Math.random() * 3000); // 2-5 seconds
        break;
      case 'api_call':
        await this.delay(500 + Math.random() * 1500); // 0.5-2 seconds
        break;
      case 'file_processing':
        await this.delay(3000 + Math.random() * 4000); // 3-7 seconds
        break;
      default:
        await this.delay(1000 + Math.random() * 2000); // 1-3 seconds
    }

    // Simulate occasional errors (5% failure rate)
    if (Math.random() < 0.05) {
      throw new Error(`Simulated task failure for ${task.id}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async start(): Promise<void> {
    // Test heartbeat connectivity
    const connected = await this.heartbeat.testConnection();
    if (!connected) {
      console.warn(`⚠️  Dashboard not reachable, but agent will continue`);
    }

    // Start the Express server
    this.app.listen(this.port, () => {
      console.log(`🚀 ${this.agentType} listening on port ${this.port}`);
      console.log(`📊 Health: http://localhost:${this.port}/health`);
      console.log(`📋 Tasks: POST http://localhost:${this.port}/tasks`);
      console.log(`📈 Status: http://localhost:${this.port}/status`);
      console.log(`🎯 Queue: http://localhost:${this.port}/queue`);
    });

    // Start cost-effective heartbeat (saves $600+/month)
    this.heartbeat.startHeartbeat();

    // Register with dashboard
    await this.registerWithDashboard();
  }

  private async registerWithDashboard(): Promise<void> {
    try {
      const response = await fetch('http://localhost:4001/api/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: this.agentId,
          type: this.agentType,
          port: this.port,
          capabilities: ['task_execution', 'message_handling', 'api_endpoints'],
          status: 'online',
          version: '1.0.0'
        })
      });

      if (response.ok) {
        console.log(`✅ Registered with dashboard successfully`);
      } else {
        console.warn(`⚠️  Dashboard registration failed: ${response.status}`);
      }
    } catch (error) {
      console.warn(`⚠️  Could not register with dashboard:`, error);
    }
  }

  public stop(): void {
    console.log(`🛑 Stopping ${this.agentType} (${this.agentId})`);
    this.heartbeat.stopHeartbeat();
  }
}

// Example usage - create and start different types of agents
export { TypeScriptAgent };

// If running directly, start an example agent
if (import.meta.url === `file://${process.argv[1]}`) {
  const agentType = process.env.AGENT_TYPE || 'developer';
  const agentId = process.env.AGENT_ID || `${agentType}-${Date.now()}`;
  const port = parseInt(process.env.PORT || '5001');

  const agent = new TypeScriptAgent(agentId, agentType, port);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    agent.stop();
    process.exit(0);
  });

  agent.start().catch(error => {
    console.error('❌ Failed to start agent:', error);
    process.exit(1);
  });
}
