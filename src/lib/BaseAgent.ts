import express, { Express, Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import winston from 'winston';
import * as schedule from 'node-schedule';

export interface AgentConfig {
  id: string;
  type: 'architect' | 'developer' | 'devops' | 'qa' | 'manager';
  name: string;
  port: number;
  dashboardUrl: string;
  capabilities: string[];
  awsBackendPolicy?: {
    priorityOrder: string[];
    objectives: string[];
    defaultChoice: string;
  };
}

export interface TaskPayload {
  taskId: string;
  task: string;
  priority: 'low' | 'medium' | 'high';
  context: {
    project?: string;
    timeout?: number;
    dependencies?: string[];
    [key: string]: any;
  };
}

export interface TaskResult {
  taskId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  completedAt?: string;
}

export interface AgentStatus {
  id: string;
  type: string;
  status: 'running' | 'stopped' | 'error' | 'idle' | 'busy';
  uptime: number;
  tasksCompleted: number;
  tasksInProgress: number;
  lastActivity: string;
  cpu?: number;
  memory?: number;
  capabilities: string[];
}

export abstract class BaseAgent {
  protected app: Express;
  protected config: AgentConfig;
  protected logger: winston.Logger;
  protected tasks: Map<string, TaskResult> = new Map();
  protected conversations: any[] = [];
  protected startTime: Date;
  protected tasksCompleted = 0;
  protected tasksInProgress = 0;
  protected heartbeatJob?: schedule.Job;
  protected status: 'running' | 'stopped' | 'error' | 'idle' | 'busy' = 'idle';

  constructor(config: AgentConfig) {
    this.config = config;
    this.startTime = new Date();
    this.app = express();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${this.config.name}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: `logs/${this.config.type}-agent.log` 
        })
      ]
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        agent: this.config.name,
        uptime: Date.now() - this.startTime.getTime()
      });
    });

    // Agent status
    this.app.get('/agent/:agentId/status', (req: Request, res: Response) => {
      if (req.params.agentId !== this.config.id) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(this.getStatus());
    });

    // Task handling
    this.app.post('/agent/:agentId/task', async (req: Request, res: Response) => {
      if (req.params.agentId !== this.config.id) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      
      try {
        const taskPayload: TaskPayload = req.body;
        const result = await this.handleTask(taskPayload);
        res.json(result);
      } catch (error) {
        this.logger.error('Task handling error:', error);
        res.status(500).json({ 
          error: 'Task execution failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Message handling
    this.app.post('/agent/:agentId/message', async (req: Request, res: Response) => {
      if (req.params.agentId !== this.config.id) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      
      try {
        const message = req.body;
        const response = await this.handleMessage(message);
        res.json(response);
      } catch (error) {
        this.logger.error('Message handling error:', error);
        res.status(500).json({ 
          error: 'Message processing failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get conversation history
    this.app.get('/agent/:agentId/conversation', (req: Request, res: Response) => {
      if (req.params.agentId !== this.config.id) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(this.conversations);
    });

    // Control endpoint
    this.app.post('/agent/:agentId/control', async (req: Request, res: Response) => {
      if (req.params.agentId !== this.config.id) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      
      const { action } = req.body;
      switch (action) {
        case 'stop':
          await this.stop();
          res.json({ status: 'stopped' });
          break;
        case 'restart':
          await this.restart();
          res.json({ status: 'restarted' });
          break;
        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    });
  }

  protected async registerWithDashboard(): Promise<void> {
    try {
      const registrationData = {
        id: this.config.id,
        type: this.config.type,
        name: this.config.name,
        port: this.config.port,
        capabilities: this.config.capabilities,
        status: 'running',
        endpoint: `http://localhost:${this.config.port}`,
        registeredAt: new Date().toISOString()
      };

      const response = await axios.post(
        `${this.config.dashboardUrl}/api/dashboard/agents/register`,
        registrationData,
        { timeout: 5000 }
      );

      if (response.status === 200) {
        this.logger.info('Successfully registered with dashboard');
      }
    } catch (error) {
      // Dashboard might not have registration endpoint yet, just log
      this.logger.warn('Dashboard registration not available (endpoint may not exist yet)');
    }
  }

  protected async sendHeartbeat(): Promise<void> {
    try {
      const heartbeatData = {
        id: this.config.id,
        type: this.config.type,
        status: this.status,
        uptime: Date.now() - this.startTime.getTime(),
        tasksCompleted: this.tasksCompleted,
        tasksInProgress: this.tasksInProgress,
        lastActivity: new Date().toISOString(),
        metrics: {
          cpu: process.cpuUsage().user / 1000000, // Convert to seconds
          memory: process.memoryUsage().heapUsed / 1024 / 1024 // Convert to MB
        }
      };

      await axios.post(
        `${this.config.dashboardUrl}/api/dashboard/agents/${this.config.id}/heartbeat`,
        heartbeatData,
        { timeout: 5000 }
      );
    } catch (error) {
      // Heartbeat endpoint might not exist yet, just log
      this.logger.debug('Heartbeat endpoint not available');
    }
  }

  protected getStatus(): AgentStatus {
    return {
      id: this.config.id,
      type: this.config.type,
      status: this.status,
      uptime: Date.now() - this.startTime.getTime(),
      tasksCompleted: this.tasksCompleted,
      tasksInProgress: this.tasksInProgress,
      lastActivity: new Date().toISOString(),
      cpu: process.cpuUsage().user / 1000000,
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      capabilities: this.config.capabilities
    };
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.config.port, async () => {
        this.logger.info(`${this.config.name} started on port ${this.config.port}`);
        
        // Register with dashboard
        await this.registerWithDashboard();
        
        // Start heartbeat (every 30 seconds)
        this.heartbeatJob = schedule.scheduleJob('*/30 * * * * *', async () => {
          await this.sendHeartbeat();
        });

        // Call agent-specific initialization
        await this.initialize();
        
        this.status = 'idle';
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    this.logger.info('Stopping agent...');
    this.status = 'stopped';
    
    if (this.heartbeatJob) {
      this.heartbeatJob.cancel();
    }
    
    // Call agent-specific cleanup
    await this.cleanup();
  }

  public async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  // Abstract methods to be implemented by specific agents
  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;
  protected abstract handleTask(payload: TaskPayload): Promise<TaskResult>;
  protected abstract handleMessage(message: any): Promise<any>;
}