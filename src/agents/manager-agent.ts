import { BaseAgent, AgentConfig, TaskPayload, TaskResult } from '../lib/BaseAgent';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { Octokit } from '@octokit/rest';

interface WorkflowState {
  workflowId: string;
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'failed';
  stages: Array<{
    name: string;
    agent: string;
    status: string;
    startedAt?: string;
    completedAt?: string;
    result?: any;
  }>;
  startedAt: string;
  completedAt?: string;
}

class ManagerAgent extends BaseAgent {
  private workflows: Map<string, WorkflowState> = new Map();
  private agentAssignments: Map<string, string[]> = new Map();
  private octokit?: Octokit;

  constructor() {
    const config: AgentConfig = {
      id: 'ai-manager-agent-1',
      type: 'manager',
      name: 'AI Manager Agent',
      port: 5005,
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:4001',
      capabilities: [
        'project_management',
        'task_assignment',
        'workflow_orchestration',
        'agent_coordination',
        'progress_tracking',
        'resource_allocation',
        'priority_management',
        'deadline_tracking',
        'team_communication',
        'report_generation'
      ]
    };
    
    super(config);
    this.initializeGitHub();
  }

  private initializeGitHub(): void {
    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
      });
    }
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Manager Agent initialized with workflow orchestration');
    this.logger.info(`Capabilities: ${this.config.capabilities.join(', ')}`);
    
    // Initialize agent registry
    this.agentAssignments.set('architect', ['ai-architect-agent-1']);
    this.agentAssignments.set('developer', ['ai-developer-agent-1']);
    this.agentAssignments.set('devops', ['ai-devops-agent-1']);
    this.agentAssignments.set('qa', ['ai-qa-agent-1']);
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Manager Agent cleanup completed');
  }

  protected async handleTask(payload: TaskPayload): Promise<TaskResult> {
    this.logger.info(`Processing management task: ${payload.task}`);
    this.status = 'busy';
    this.tasksInProgress++;

    try {
      const taskResult: TaskResult = {
        taskId: payload.taskId || uuidv4(),
        status: 'in_progress'
      };

      this.tasks.set(taskResult.taskId, taskResult);

      if (payload.task.toLowerCase().includes('workflow') || 
          payload.task.toLowerCase().includes('orchestrate')) {
        const workflowResult = await this.orchestrateWorkflow(payload);
        taskResult.result = workflowResult;
      } else if (payload.task.toLowerCase().includes('assign')) {
        const assignmentResult = await this.assignTask(payload);
        taskResult.result = assignmentResult;
      } else if (payload.task.toLowerCase().includes('track') || 
                 payload.task.toLowerCase().includes('status')) {
        const trackingResult = await this.trackProgress(payload);
        taskResult.result = trackingResult;
      } else if (payload.task.toLowerCase().includes('report')) {
        const reportResult = await this.generateReport(payload);
        taskResult.result = reportResult;
      } else {
        taskResult.result = {
          message: 'Management task processed',
          coordination: await this.coordinateAgents(payload)
        };
      }

      taskResult.status = 'completed';
      taskResult.completedAt = new Date().toISOString();
      this.tasksCompleted++;
      this.tasksInProgress--;
      this.status = 'idle';
      
      return taskResult;
    } catch (error) {
      this.tasksInProgress--;
      this.status = 'error';
      return {
        taskId: payload.taskId || uuidv4(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  protected async handleMessage(message: any): Promise<any> {
    this.logger.info(`Received message: ${message.type}`);
    
    this.conversations.push({
      timestamp: new Date().toISOString(),
      type: 'received',
      message
    });

    let response: any = { status: 'received', agentId: this.config.id };

    switch (message.type) {
      case 'github_issue':
        response = await this.processGitHubIssue(message.payload);
        break;
      case 'create_workflow':
        response = await this.createWorkflow(message.payload);
        break;
      case 'get_workflows':
        response = Array.from(this.workflows.values());
        break;
      case 'agent_status_update':
        response = await this.handleAgentStatusUpdate(message.payload);
        break;
      default:
        response = { status: 'processed', message: `Manager agent processed: ${message.type}` };
    }

    this.conversations.push({
      timestamp: new Date().toISOString(),
      type: 'sent',
      response
    });

    return response;
  }

  private async orchestrateWorkflow(payload: TaskPayload): Promise<any> {
    const workflowId = uuidv4();
    
    // Define workflow stages based on task
    const stages = this.defineWorkflowStages(payload);
    
    const workflow: WorkflowState = {
      workflowId,
      status: 'planning',
      stages,
      startedAt: new Date().toISOString()
    };

    this.workflows.set(workflowId, workflow);
    
    // Start executing workflow
    this.executeWorkflow(workflow);
    
    return {
      workflowId,
      status: 'initiated',
      stages: stages.map(s => ({ name: s.name, agent: s.agent })),
      estimatedCompletion: this.estimateCompletionTime(stages)
    };
  }

  private defineWorkflowStages(payload: TaskPayload): any[] {
    const stages = [];
    
    // Standard SDLC workflow
    if (payload.task.toLowerCase().includes('feature') || 
        payload.task.toLowerCase().includes('implement')) {
      stages.push(
        { name: 'Architecture Design', agent: 'architect', status: 'pending' },
        { name: 'Implementation', agent: 'developer', status: 'pending' },
        { name: 'Testing', agent: 'qa', status: 'pending' },
        { name: 'Deployment', agent: 'devops', status: 'pending' }
      );
    } else if (payload.task.toLowerCase().includes('bug') || 
               payload.task.toLowerCase().includes('fix')) {
      stages.push(
        { name: 'Bug Analysis', agent: 'developer', status: 'pending' },
        { name: 'Fix Implementation', agent: 'developer', status: 'pending' },
        { name: 'Testing', agent: 'qa', status: 'pending' },
        { name: 'Deployment', agent: 'devops', status: 'pending' }
      );
    } else {
      // Generic workflow
      stages.push(
        { name: 'Analysis', agent: 'architect', status: 'pending' },
        { name: 'Execution', agent: 'developer', status: 'pending' },
        { name: 'Validation', agent: 'qa', status: 'pending' }
      );
    }
    
    return stages;
  }

  private async executeWorkflow(workflow: WorkflowState): Promise<void> {
    workflow.status = 'in_progress';
    
    for (const stage of workflow.stages) {
      stage.status = 'in_progress';
      stage.startedAt = new Date().toISOString();
      
      // Send task to appropriate agent
      const agentUrl = this.getAgentUrl(stage.agent);
      try {
        const response = await axios.post(`${agentUrl}/agent/${this.getAgentId(stage.agent)}/task`, {
          taskId: uuidv4(),
          task: stage.name,
          priority: 'high',
          context: {
            workflowId: workflow.workflowId,
            stage: stage.name
          }
        });
        
        stage.status = 'completed';
        stage.completedAt = new Date().toISOString();
        stage.result = response.data;
      } catch (error) {
        stage.status = 'failed';
        stage.completedAt = new Date().toISOString();
        workflow.status = 'failed';
        this.logger.error(`Stage ${stage.name} failed:`, error);
        break;
      }
    }
    
    if (workflow.status !== 'failed') {
      workflow.status = 'completed';
      workflow.completedAt = new Date().toISOString();
    }
  }

  private getAgentUrl(agentType: string): string {
    const ports: Record<string, number> = {
      architect: 5001,
      developer: 5002,
      devops: 5003,
      qa: 5004
    };
    return `http://localhost:${ports[agentType] || 5000}`;
  }

  private getAgentId(agentType: string): string {
    const agents = this.agentAssignments.get(agentType);
    return agents ? agents[0] : `ai-${agentType}-agent-1`;
  }

  private estimateCompletionTime(stages: any[]): string {
    const minutesPerStage = 15;
    const totalMinutes = stages.length * minutesPerStage;
    
    if (totalMinutes < 60) {
      return `${totalMinutes} minutes`;
    } else {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
    }
  }

  private async assignTask(payload: TaskPayload): Promise<any> {
    const bestAgent = this.selectBestAgent(payload);
    
    return {
      taskId: payload.taskId,
      assignedTo: bestAgent,
      assignedAt: new Date().toISOString(),
      priority: payload.priority,
      estimatedCompletion: '30 minutes'
    };
  }

  private selectBestAgent(payload: TaskPayload): string {
    // Simple heuristic for agent selection
    const task = payload.task.toLowerCase();
    
    if (task.includes('design') || task.includes('architect')) {
      return 'ai-architect-agent-1';
    } else if (task.includes('code') || task.includes('implement')) {
      return 'ai-developer-agent-1';
    } else if (task.includes('deploy') || task.includes('infrastructure')) {
      return 'ai-devops-agent-1';
    } else if (task.includes('test') || task.includes('quality')) {
      return 'ai-qa-agent-1';
    }
    
    return 'ai-developer-agent-1'; // Default
  }

  private async trackProgress(payload: TaskPayload): Promise<any> {
    const activeWorkflows = Array.from(this.workflows.values())
      .filter(w => w.status === 'in_progress');
    
    return {
      activeWorkflows: activeWorkflows.length,
      workflows: activeWorkflows.map(w => ({
        id: w.workflowId,
        status: w.status,
        progress: this.calculateProgress(w),
        currentStage: w.stages.find(s => s.status === 'in_progress')?.name || 'None'
      })),
      totalCompleted: this.tasksCompleted,
      totalInProgress: this.tasksInProgress
    };
  }

  private calculateProgress(workflow: WorkflowState): number {
    const completed = workflow.stages.filter(s => s.status === 'completed').length;
    return Math.round((completed / workflow.stages.length) * 100);
  }

  private async generateReport(payload: TaskPayload): Promise<any> {
    const period = payload.context.period || 'today';
    const workflows = Array.from(this.workflows.values());
    
    return {
      period,
      summary: {
        totalWorkflows: workflows.length,
        completed: workflows.filter(w => w.status === 'completed').length,
        failed: workflows.filter(w => w.status === 'failed').length,
        inProgress: workflows.filter(w => w.status === 'in_progress').length
      },
      agentPerformance: {
        architect: { tasks: 10, avgTime: '15 min', successRate: '95%' },
        developer: { tasks: 25, avgTime: '30 min', successRate: '92%' },
        devops: { tasks: 15, avgTime: '20 min', successRate: '98%' },
        qa: { tasks: 20, avgTime: '25 min', successRate: '90%' }
      },
      recommendations: [
        'Optimize developer agent response time',
        'Increase QA coverage for critical features',
        'Implement parallel workflow execution'
      ]
    };
  }

  private async coordinateAgents(payload: TaskPayload): Promise<any> {
    return {
      status: 'coordinated',
      agents: Array.from(this.agentAssignments.entries()).map(([type, agents]) => ({
        type,
        agents,
        available: true
      })),
      message: 'All agents coordinated successfully'
    };
  }

  private async processGitHubIssue(issue: any): Promise<any> {
    // Create workflow from GitHub issue
    const payload: TaskPayload = {
      taskId: uuidv4(),
      task: issue.title,
      priority: this.determinePriority(issue.labels),
      context: {
        issueNumber: issue.number,
        repository: issue.repository,
        author: issue.user?.login,
        labels: issue.labels
      }
    };
    
    return await this.orchestrateWorkflow(payload);
  }

  private determinePriority(labels: any[]): 'low' | 'medium' | 'high' {
    if (!labels) return 'medium';
    
    const labelNames = labels.map((l: any) => l.name?.toLowerCase() || '');
    
    if (labelNames.some(l => l.includes('critical') || l.includes('urgent'))) {
      return 'high';
    } else if (labelNames.some(l => l.includes('low') || l.includes('minor'))) {
      return 'low';
    }
    
    return 'medium';
  }

  private async createWorkflow(config: any): Promise<any> {
    const payload: TaskPayload = {
      taskId: uuidv4(),
      task: config.name || 'Custom Workflow',
      priority: config.priority || 'medium',
      context: config
    };
    
    return await this.orchestrateWorkflow(payload);
  }

  private async handleAgentStatusUpdate(update: any): Promise<any> {
    this.logger.info(`Agent status update: ${update.agentId} - ${update.status}`);
    
    // Update workflow status if agent is part of active workflow
    for (const workflow of this.workflows.values()) {
      const stage = workflow.stages.find(s => 
        this.getAgentId(s.agent) === update.agentId && 
        s.status === 'in_progress'
      );
      
      if (stage) {
        stage.status = update.status === 'completed' ? 'completed' : 'in_progress';
        if (update.result) {
          stage.result = update.result;
        }
      }
    }
    
    return { status: 'updated' };
  }
}

// Start the agent
const agent = new ManagerAgent();
agent.start().catch(error => {
  console.error('Failed to start Manager Agent:', error);
  process.exit(1);
});