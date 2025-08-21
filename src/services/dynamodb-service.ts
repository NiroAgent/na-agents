import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

interface Task {
  taskId: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assignedAgent?: string;
  description: string;
  context?: any;
  result?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Agent {
  agentId: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  capabilities: string[];
  lastHeartbeat: string;
  tasksCompleted: number;
  tasksInProgress: number;
  metadata?: any;
}

interface Message {
  messageId: string;
  conversationId: string;
  sender: string;
  recipient?: string;
  content: string;
  type: 'task' | 'response' | 'error' | 'info';
  timestamp: string;
  metadata?: any;
}

interface Workflow {
  workflowId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  steps: WorkflowStep[];
  currentStep: number;
  createdAt: string;
  completedAt?: string;
}

interface WorkflowStep {
  stepNumber: number;
  agentId: string;
  taskType: string;
  input: any;
  output?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
}

export class DynamoDBService {
  private client: DynamoDBDocumentClient;
  private logger: winston.Logger;
  private readonly TASKS_TABLE = process.env.DYNAMODB_TASKS_TABLE || 'na-agents-tasks';
  private readonly AGENTS_TABLE = process.env.DYNAMODB_AGENTS_TABLE || 'na-agents-agents';
  private readonly MESSAGES_TABLE = process.env.DYNAMODB_MESSAGES_TABLE || 'na-agents-messages';
  private readonly WORKFLOWS_TABLE = process.env.DYNAMODB_WORKFLOWS_TABLE || 'na-agents-workflows';

  constructor() {
    // Initialize DynamoDB client
    const dynamoClient = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.DYNAMODB_ENDPOINT && {
        endpoint: process.env.DYNAMODB_ENDPOINT // For local DynamoDB
      })
    });

    this.client = DynamoDBDocumentClient.from(dynamoClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: true
      }
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/dynamodb-service.log' })
      ]
    });
  }

  // ============ TASK OPERATIONS ============

  async createTask(task: Omit<Task, 'taskId' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const newTask: Task = {
      ...task,
      taskId: uuidv4(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await this.client.send(new PutCommand({
        TableName: this.TASKS_TABLE,
        Item: {
          PK: `TASK#${newTask.taskId}`,
          SK: 'META',
          ...newTask,
          GSI1PK: `STATUS#${newTask.status}`,
          GSI1SK: newTask.createdAt
        }
      }));

      this.logger.info('Task created', { taskId: newTask.taskId });
      return newTask;
    } catch (error) {
      this.logger.error('Failed to create task', error);
      throw error;
    }
  }

  async getTask(taskId: string): Promise<Task | null> {
    try {
      const result = await this.client.send(new GetCommand({
        TableName: this.TASKS_TABLE,
        Key: {
          PK: `TASK#${taskId}`,
          SK: 'META'
        }
      }));

      return result.Item as Task || null;
    } catch (error) {
      this.logger.error('Failed to get task', error);
      throw error;
    }
  }

  async updateTaskStatus(taskId: string, status: Task['status'], result?: any, error?: string): Promise<void> {
    try {
      const updateExpression = 'SET #status = :status, updatedAt = :updatedAt' +
        (result ? ', #result = :result' : '') +
        (error ? ', #error = :error' : '') +
        (status === 'completed' || status === 'failed' ? ', completedAt = :completedAt' : '');

      const expressionAttributeNames: any = {
        '#status': 'status'
      };
      if (result) expressionAttributeNames['#result'] = 'result';
      if (error) expressionAttributeNames['#error'] = 'error';

      const expressionAttributeValues: any = {
        ':status': status,
        ':updatedAt': new Date().toISOString()
      };
      if (result) expressionAttributeValues[':result'] = result;
      if (error) expressionAttributeValues[':error'] = error;
      if (status === 'completed' || status === 'failed') {
        expressionAttributeValues[':completedAt'] = new Date().toISOString();
      }

      await this.client.send(new UpdateCommand({
        TableName: this.TASKS_TABLE,
        Key: {
          PK: `TASK#${taskId}`,
          SK: 'META'
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      this.logger.info('Task status updated', { taskId, status });
    } catch (error) {
      this.logger.error('Failed to update task status', error);
      throw error;
    }
  }

  async getTasksByStatus(status: Task['status']): Promise<Task[]> {
    try {
      const result = await this.client.send(new QueryCommand({
        TableName: this.TASKS_TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `STATUS#${status}`
        },
        ScanIndexForward: false // Most recent first
      }));

      return (result.Items || []) as Task[];
    } catch (error) {
      this.logger.error('Failed to get tasks by status', error);
      throw error;
    }
  }

  // ============ AGENT OPERATIONS ============

  async registerAgent(agent: Omit<Agent, 'lastHeartbeat'>): Promise<Agent> {
    const newAgent: Agent = {
      ...agent,
      lastHeartbeat: new Date().toISOString()
    };

    try {
      await this.client.send(new PutCommand({
        TableName: this.AGENTS_TABLE,
        Item: {
          PK: `AGENT#${newAgent.agentId}`,
          SK: 'STATUS',
          ...newAgent
        }
      }));

      this.logger.info('Agent registered', { agentId: newAgent.agentId });
      return newAgent;
    } catch (error) {
      this.logger.error('Failed to register agent', error);
      throw error;
    }
  }

  async updateAgentHeartbeat(agentId: string, status?: Agent['status']): Promise<void> {
    try {
      const updateExpression = 'SET lastHeartbeat = :heartbeat' +
        (status ? ', #status = :status' : '');

      const expressionAttributeNames: any = {};
      if (status) expressionAttributeNames['#status'] = 'status';

      const expressionAttributeValues: any = {
        ':heartbeat': new Date().toISOString()
      };
      if (status) expressionAttributeValues[':status'] = status;

      await this.client.send(new UpdateCommand({
        TableName: this.AGENTS_TABLE,
        Key: {
          PK: `AGENT#${agentId}`,
          SK: 'STATUS'
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      this.logger.debug('Agent heartbeat updated', { agentId });
    } catch (error) {
      this.logger.error('Failed to update agent heartbeat', error);
      throw error;
    }
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    try {
      const result = await this.client.send(new GetCommand({
        TableName: this.AGENTS_TABLE,
        Key: {
          PK: `AGENT#${agentId}`,
          SK: 'STATUS'
        }
      }));

      return result.Item as Agent || null;
    } catch (error) {
      this.logger.error('Failed to get agent', error);
      throw error;
    }
  }

  async getOnlineAgents(): Promise<Agent[]> {
    try {
      const result = await this.client.send(new ScanCommand({
        TableName: this.AGENTS_TABLE,
        FilterExpression: '#status = :status AND SK = :sk',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'online',
          ':sk': 'STATUS'
        }
      }));

      return (result.Items || []) as Agent[];
    } catch (error) {
      this.logger.error('Failed to get online agents', error);
      throw error;
    }
  }

  // ============ MESSAGE OPERATIONS ============

  async saveMessage(message: Omit<Message, 'messageId' | 'timestamp'>): Promise<Message> {
    const newMessage: Message = {
      ...message,
      messageId: uuidv4(),
      timestamp: new Date().toISOString()
    };

    try {
      await this.client.send(new PutCommand({
        TableName: this.MESSAGES_TABLE,
        Item: {
          PK: `CONV#${newMessage.conversationId}`,
          SK: `MSG#${newMessage.timestamp}#${newMessage.messageId}`,
          ...newMessage
        }
      }));

      this.logger.info('Message saved', { messageId: newMessage.messageId });
      return newMessage;
    } catch (error) {
      this.logger.error('Failed to save message', error);
      throw error;
    }
  }

  async getConversation(conversationId: string, limit: number = 50): Promise<Message[]> {
    try {
      const result = await this.client.send(new QueryCommand({
        TableName: this.MESSAGES_TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `CONV#${conversationId}`,
          ':sk': 'MSG#'
        },
        ScanIndexForward: false, // Most recent first
        Limit: limit
      }));

      return (result.Items || []) as Message[];
    } catch (error) {
      this.logger.error('Failed to get conversation', error);
      throw error;
    }
  }

  // ============ WORKFLOW OPERATIONS ============

  async createWorkflow(workflow: Omit<Workflow, 'workflowId' | 'createdAt'>): Promise<Workflow> {
    const newWorkflow: Workflow = {
      ...workflow,
      workflowId: uuidv4(),
      createdAt: new Date().toISOString()
    };

    try {
      // Save workflow metadata
      await this.client.send(new PutCommand({
        TableName: this.WORKFLOWS_TABLE,
        Item: {
          PK: `WORKFLOW#${newWorkflow.workflowId}`,
          SK: 'META',
          ...newWorkflow
        }
      }));

      // Save each step
      for (const step of newWorkflow.steps) {
        await this.client.send(new PutCommand({
          TableName: this.WORKFLOWS_TABLE,
          Item: {
            PK: `WORKFLOW#${newWorkflow.workflowId}`,
            SK: `STEP#${String(step.stepNumber).padStart(3, '0')}`,
            ...step
          }
        }));
      }

      this.logger.info('Workflow created', { workflowId: newWorkflow.workflowId });
      return newWorkflow;
    } catch (error) {
      this.logger.error('Failed to create workflow', error);
      throw error;
    }
  }

  async updateWorkflowStep(workflowId: string, stepNumber: number, updates: Partial<WorkflowStep>): Promise<void> {
    try {
      const updateExpressions: string[] = [];
      const expressionAttributeNames: any = {};
      const expressionAttributeValues: any = {};

      if (updates.status) {
        updateExpressions.push('#status = :status');
        expressionAttributeNames['#status'] = 'status';
        expressionAttributeValues[':status'] = updates.status;
      }

      if (updates.output) {
        updateExpressions.push('#output = :output');
        expressionAttributeNames['#output'] = 'output';
        expressionAttributeValues[':output'] = updates.output;
      }

      if (updates.startedAt) {
        updateExpressions.push('startedAt = :startedAt');
        expressionAttributeValues[':startedAt'] = updates.startedAt;
      }

      if (updates.completedAt) {
        updateExpressions.push('completedAt = :completedAt');
        expressionAttributeValues[':completedAt'] = updates.completedAt;
      }

      await this.client.send(new UpdateCommand({
        TableName: this.WORKFLOWS_TABLE,
        Key: {
          PK: `WORKFLOW#${workflowId}`,
          SK: `STEP#${String(stepNumber).padStart(3, '0')}`
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues
      }));

      this.logger.info('Workflow step updated', { workflowId, stepNumber });
    } catch (error) {
      this.logger.error('Failed to update workflow step', error);
      throw error;
    }
  }

  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      const result = await this.client.send(new QueryCommand({
        TableName: this.WORKFLOWS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `WORKFLOW#${workflowId}`
        }
      }));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      // Separate metadata and steps
      const metadata = result.Items.find(item => item.SK === 'META');
      const steps = result.Items
        .filter(item => item.SK.startsWith('STEP#'))
        .sort((a, b) => a.SK.localeCompare(b.SK))
        .map(item => {
          const { PK, SK, ...step } = item;
          return step as WorkflowStep;
        });

      if (!metadata) {
        return null;
      }

      return {
        ...metadata,
        steps
      } as Workflow;
    } catch (error) {
      this.logger.error('Failed to get workflow', error);
      throw error;
    }
  }

  // ============ UTILITY OPERATIONS ============

  async cleanup(olderThanDays: number = 7): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffISO = cutoffDate.toISOString();

    try {
      // Clean up old completed tasks
      const oldTasks = await this.client.send(new ScanCommand({
        TableName: this.TASKS_TABLE,
        FilterExpression: '#status IN (:completed, :failed) AND completedAt < :cutoff',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':completed': 'completed',
          ':failed': 'failed',
          ':cutoff': cutoffISO
        }
      }));

      for (const item of oldTasks.Items || []) {
        await this.client.send(new DeleteCommand({
          TableName: this.TASKS_TABLE,
          Key: {
            PK: item.PK,
            SK: item.SK
          }
        }));
      }

      this.logger.info(`Cleaned up ${oldTasks.Items?.length || 0} old tasks`);
    } catch (error) {
      this.logger.error('Failed to cleanup old data', error);
      throw error;
    }
  }

  /**
   * Initialize tables (for local DynamoDB or first-time setup)
   */
  async initializeTables(): Promise<void> {
    // This would typically be done via CloudFormation/CDK
    // Included here for local development
    this.logger.info('Table initialization should be done via infrastructure as code');
  }
}

// Singleton instance
export const dynamoDBService = new DynamoDBService();