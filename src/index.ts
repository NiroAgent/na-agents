#!/usr/bin/env node

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface AgentProcess {
  name: string;
  script: string;
  process?: ChildProcess;
  status: 'starting' | 'running' | 'stopped' | 'error';
  restartCount: number;
}

class MultiAgentSystem {
  private agents: Map<string, AgentProcess> = new Map();
  private isShuttingDown = false;

  constructor() {
    // Define all agents
    this.agents.set('architect', {
      name: 'AI Architect Agent',
      script: 'architect-agent.ts',
      status: 'stopped',
      restartCount: 0
    });

    this.agents.set('developer', {
      name: 'AI Developer Agent',
      script: 'developer-agent.ts',
      status: 'stopped',
      restartCount: 0
    });

    this.agents.set('devops', {
      name: 'AI DevOps Agent',
      script: 'devops-agent.ts',
      status: 'stopped',
      restartCount: 0
    });

    this.agents.set('qa', {
      name: 'AI QA Agent',
      script: 'qa-agent.ts',
      status: 'stopped',
      restartCount: 0
    });

    this.agents.set('manager', {
      name: 'AI Manager Agent',
      script: 'manager-agent.ts',
      status: 'stopped',
      restartCount: 0
    });

    // Setup graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  public async start(): Promise<void> {
    console.log('🚀 Starting Multi-Agent System...');
    console.log('📊 Dashboard URL:', process.env.DASHBOARD_URL || 'http://localhost:4001');
    console.log('');

    // Check if logs directory exists
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Start each agent with a delay to avoid port conflicts
    for (const [type, agent] of this.agents) {
      await this.startAgent(type, agent);
      await this.delay(2000); // 2 second delay between agent starts
    }

    console.log('');
    console.log('✅ All agents started successfully!');
    console.log('');
    this.printStatus();
    
    // Monitor agents
    setInterval(() => {
      if (!this.isShuttingDown) {
        this.checkAgents();
      }
    }, 30000); // Check every 30 seconds
  }

  private async startAgent(type: string, agent: AgentProcess): Promise<void> {
    console.log(`Starting ${agent.name}...`);
    agent.status = 'starting';

    const scriptPath = path.join(__dirname, 'agents', agent.script);
    
    // Use ts-node in development, node with compiled JS in production
    const isProduction = process.env.NODE_ENV === 'production';
    const command = isProduction ? 'node' : 'npx';
    const args = isProduction 
      ? [scriptPath.replace('.ts', '.js')]
      : ['ts-node', scriptPath];

    agent.process = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AGENT_TYPE: type
      }
    });

    agent.process.stdout?.on('data', (data) => {
      console.log(`[${type}] ${data.toString().trim()}`);
    });

    agent.process.stderr?.on('data', (data) => {
      console.error(`[${type}] ERROR: ${data.toString().trim()}`);
    });

    agent.process.on('exit', (code) => {
      if (!this.isShuttingDown) {
        console.error(`[${type}] Process exited with code ${code}`);
        agent.status = 'stopped';
        
        // Auto-restart if crashed
        if (agent.restartCount < 3) {
          agent.restartCount++;
          console.log(`[${type}] Attempting restart (${agent.restartCount}/3)...`);
          setTimeout(() => this.startAgent(type, agent), 5000);
        } else {
          agent.status = 'error';
          console.error(`[${type}] Max restart attempts reached. Agent stopped.`);
        }
      }
    });

    // Wait for agent to be ready
    await this.delay(1000);
    agent.status = 'running';
    console.log(`✓ ${agent.name} started`);
  }

  private checkAgents(): void {
    for (const [type, agent] of this.agents) {
      if (agent.status === 'stopped' && agent.restartCount < 3) {
        console.log(`[${type}] Agent is down, attempting restart...`);
        this.startAgent(type, agent);
      }
    }
  }

  private printStatus(): void {
    console.log('='.repeat(60));
    console.log('AGENT STATUS');
    console.log('='.repeat(60));
    
    const ports: Record<string, number> = {
      architect: 5001,
      developer: 5002,
      devops: 5003,
      qa: 5004,
      manager: 5005
    };

    for (const [type, agent] of this.agents) {
      const status = agent.status === 'running' ? '✅' : '❌';
      console.log(`${status} ${agent.name.padEnd(25)} http://localhost:${ports[type]}`);
    }
    
    console.log('='.repeat(60));
    console.log('');
    console.log('Dashboard: ' + (process.env.DASHBOARD_URL || 'http://localhost:4001'));
    console.log('');
    console.log('Press Ctrl+C to stop all agents');
  }

  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log('\n⏹️  Shutting down Multi-Agent System...');

    // Stop all agents
    for (const [type, agent] of this.agents) {
      if (agent.process && agent.status === 'running') {
        console.log(`Stopping ${agent.name}...`);
        agent.process.kill('SIGTERM');
        agent.status = 'stopped';
      }
    }

    // Wait for processes to terminate
    await this.delay(2000);

    // Force kill if still running
    for (const [type, agent] of this.agents) {
      if (agent.process) {
        agent.process.kill('SIGKILL');
      }
    }

    console.log('👋 All agents stopped. Goodbye!');
    process.exit(0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Start the system
const system = new MultiAgentSystem();
system.start().catch(error => {
  console.error('Failed to start Multi-Agent System:', error);
  process.exit(1);
});