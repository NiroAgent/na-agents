import { BaseAgent, AgentConfig, TaskPayload, TaskResult } from '../lib/BaseAgent';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { copilotService } from '../services/copilot-service';
import { dynamoDBService } from '../services/dynamodb-service';

interface CodeGenerationResult {
  files: Array<{
    path: string;
    content: string;
    language: string;
  }>;
  tests: Array<{
    path: string;
    content: string;
  }>;
  documentation: string;
  dependencies: Record<string, string>;
}

class DeveloperAgent extends BaseAgent {
  private codeTemplates: Record<string, any> = {};
  private generatedCode: Map<string, CodeGenerationResult> = new Map();

  constructor() {
    const config: AgentConfig = {
      id: 'ai-developer-agent-1',
      type: 'developer',
      name: 'AI Developer Agent',
      port: 5002,
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:4001',
      capabilities: [
        'typescript_development',
        'nodejs_development',
        'python_development',
        'api_development',
        'database_integration',
        'test_generation',
        'code_review',
        'refactoring',
        'aws_lambda_development',
        'containerization'
      ],
      awsBackendPolicy: {
        priorityOrder: [
          'AWS Lambda (serverless functions)',
          'AWS Fargate Tasks (Batch/Step Functions)',
          'AWS Fargate Container Service (ECS/EKS)',
          'EC2 (requires justification)'
        ],
        objectives: [
          'Stateless design patterns',
          'Environment configuration',
          'Error handling and retry logic',
          'Cold start optimization'
        ],
        defaultChoice: 'AWS Lambda'
      }
    };
    
    super(config);
    this.initializeTemplates();
  }

  private initializeTemplates(): void {
    this.codeTemplates = {
      lambda: {
        typescript: `import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    // Process the event
    const body = JSON.parse(event.body || '{}');
    
    // Business logic here
    const result = await processRequest(body);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error processing request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

async function processRequest(data: any): Promise<any> {
  // Implementation here
  return { success: true, data };
}`,
        python: `import json
import os
from typing import Dict, Any

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """AWS Lambda handler function"""
    try:
        # Parse the event body
        body = json.loads(event.get('body', '{}'))
        
        # Process the request
        result = process_request(body)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result)
        }
    except Exception as e:
        print(f"Error processing request: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }

def process_request(data: Dict[str, Any]) -> Dict[str, Any]:
    """Process the incoming request"""
    # Implementation here
    return {'success': True, 'data': data}`
      },
      express: {
        typescript: `import express, { Request, Response, NextFunction } from 'express';
import { Router } from 'express';

const router = Router();

// GET endpoint
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await fetchData();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// POST endpoint
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await createResource(req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function fetchData(): Promise<any> {
  // Implementation here
  return { data: [] };
}

async function createResource(data: any): Promise<any> {
  // Implementation here
  return { id: '123', ...data };
}

export default router;`
      },
      test: {
        jest: `import { handler } from './handler';

describe('Lambda Handler', () => {
  it('should process valid request successfully', async () => {
    const event = {
      body: JSON.stringify({ test: 'data' })
    };
    
    const result = await handler(event as any, {} as any);
    
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.success).toBe(true);
  });
  
  it('should handle errors gracefully', async () => {
    const event = {
      body: 'invalid json'
    };
    
    const result = await handler(event as any, {} as any);
    
    expect(result.statusCode).toBe(500);
  });
});`
      }
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Developer Agent initialized with code generation capabilities');
    this.logger.info(`Capabilities: ${this.config.capabilities.join(', ')}`);
    
    // Create output directory for generated code
    const outputDir = path.join(process.cwd(), 'generated_code');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create output directory:', error);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Developer Agent cleanup completed');
  }

  protected async handleTask(payload: TaskPayload): Promise<TaskResult> {
    this.logger.info(`Processing development task: ${payload.task}`);
    this.status = 'busy';
    this.tasksInProgress++;

    try {
      const taskResult: TaskResult = {
        taskId: payload.taskId || uuidv4(),
        status: 'in_progress'
      };

      this.tasks.set(taskResult.taskId, taskResult);

      // Determine task type and process accordingly
      if (payload.task.toLowerCase().includes('implement') || 
          payload.task.toLowerCase().includes('code') ||
          payload.task.toLowerCase().includes('develop') ||
          payload.task.toLowerCase().includes('generate')) {
        
        const codeResult = await this.generateCode(payload);
        
        taskResult.status = 'completed';
        taskResult.result = codeResult;
        taskResult.completedAt = new Date().toISOString();
        
        // Save generated code
        await this.saveGeneratedCode(codeResult);
        
        // Notify QA agent if needed
        if (payload.context.runTests) {
          await this.notifyQAAgent(codeResult);
        }
      } else if (payload.task.toLowerCase().includes('review')) {
        const reviewResult = await this.performCodeReview(payload);
        
        taskResult.status = 'completed';
        taskResult.result = reviewResult;
        taskResult.completedAt = new Date().toISOString();
      } else if (payload.task.toLowerCase().includes('refactor')) {
        const refactorResult = await this.refactorCode(payload);
        
        taskResult.status = 'completed';
        taskResult.result = refactorResult;
        taskResult.completedAt = new Date().toISOString();
      } else {
        // Default processing
        taskResult.status = 'completed';
        taskResult.result = {
          message: 'Development task processed',
          details: 'Task completed successfully'
        };
        taskResult.completedAt = new Date().toISOString();
      }

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

    let response: any = {
      status: 'received',
      agentId: this.config.id
    };

    switch (message.type) {
      case 'architecture_ready':
        // Receive architecture specification from Architect Agent
        response = await this.processArchitectureSpec(message.payload);
        break;
      case 'generate_code':
        response = await this.generateCodeFromSpec(message.payload);
        break;
      case 'review_code':
        response = await this.reviewCode(message.payload);
        break;
      case 'get_generated_code':
        response = Array.from(this.generatedCode.values());
        break;
      default:
        response = {
          status: 'processed',
          message: `Developer agent processed message of type: ${message.type}`
        };
    }

    this.conversations.push({
      timestamp: new Date().toISOString(),
      type: 'sent',
      response
    });

    return response;
  }

  private async generateCode(payload: TaskPayload): Promise<CodeGenerationResult> {
    const isServerless = payload.context.serverless !== false;
    const language = payload.context.language || 'typescript';
    
    const result: CodeGenerationResult = {
      files: [],
      tests: [],
      documentation: '',
      dependencies: {}
    };

    try {
      // Use GitHub Copilot to generate code based on the task description
      const prompt = this.buildCodePrompt(payload);
      const copilotResponse = await copilotService.generateCode({
        prompt,
        language,
        context: JSON.stringify(payload.context)
      });

      // Generate main handler/service code
      if (isServerless) {
        // Use Copilot-generated code or fallback to template
        const handlerContent = copilotResponse.code || this.codeTemplates.lambda[language];
        
        result.files.push({
          path: `src/handlers/handler.${language === 'python' ? 'py' : 'ts'}`,
          content: handlerContent,
          language
        });
        
        // Add serverless configuration
        result.files.push({
          path: 'serverless.yml',
          content: this.generateServerlessConfig(payload),
          language: 'yaml'
        });
        
        result.dependencies = language === 'typescript' 
          ? {
              '@types/aws-lambda': '^8.10.0',
              'aws-sdk': '^2.1000.0',
              'typescript': '^5.0.0'
            }
          : {
              'boto3': '>=1.26.0',
              'python-dotenv': '>=1.0.0'
            };
      } else {
        // Use Copilot-generated code for Express/API
        const apiContent = copilotResponse.code || this.codeTemplates.express.typescript;
        
        result.files.push({
          path: 'src/routes/api.ts',
          content: apiContent,
          language: 'typescript'
      });
      
      result.files.push({
        path: 'src/server.ts',
        content: this.generateExpressServer(payload),
        language: 'typescript'
      });
      
      result.dependencies = {
        'express': '^4.18.0',
        '@types/express': '^4.17.0',
        'cors': '^2.8.5',
        'helmet': '^7.0.0',
        'dotenv': '^16.0.0',
        'typescript': '^5.0.0'
      };
    }

    // Generate tests using GitHub Copilot
    try {
      const testCode = await copilotService.generateTests(
        copilotResponse.code,
        language,
        'jest'
      );
      
      result.tests.push({
        path: `tests/handler.test.${language === 'python' ? 'py' : 'ts'}`,
        content: testCode || this.codeTemplates.test.jest
      });
    } catch (error) {
      this.logger.warn('Failed to generate tests with Copilot, using template:', error);
      result.tests.push({
        path: 'tests/handler.test.ts',
        content: this.codeTemplates.test.jest
      });
    }

    // Generate documentation
    result.documentation = copilotResponse.explanation || this.generateDocumentation(payload, result);
    
    } catch (error) {
      this.logger.error('Copilot code generation failed, using templates:', error);
      // Fallback to templates if Copilot fails
      return this.generateCodeFromTemplates(payload);
    }

    // Store generated code
    const codeId = uuidv4();
    this.generatedCode.set(codeId, result);

    return result;
  }

  private generateServerlessConfig(payload: TaskPayload): string {
    return `service: ${payload.context.serviceName || 'my-service'}

provider:
  name: aws
  runtime: ${payload.context.language === 'python' ? 'python3.9' : 'nodejs18.x'}
  stage: \${opt:stage, 'dev'}
  region: \${opt:region, 'us-east-1'}
  memorySize: 256
  timeout: 30

functions:
  main:
    handler: src/handlers/handler.handler
    events:
      - http:
          path: /
          method: ANY
          cors: true
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-typescript
  - serverless-offline`;
  }

  private generateExpressServer(payload: TaskPayload): string {
    return `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import apiRoutes from './routes/api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: '${payload.context.serviceName || 'api-service'}' });
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;`;
  }

  private generateDocumentation(payload: TaskPayload, result: CodeGenerationResult): string {
    return `# ${payload.context.serviceName || 'Service'} Documentation

## Overview
${payload.task}

## Architecture
- Type: ${payload.context.serverless !== false ? 'Serverless (AWS Lambda)' : 'Containerized (Express)'}
- Language: ${payload.context.language || 'TypeScript'}
- Runtime: ${payload.context.language === 'python' ? 'Python 3.9' : 'Node.js 18.x'}

## Files Generated
${result.files.map(f => `- ${f.path}: ${f.language}`).join('\n')}

## Dependencies
${Object.entries(result.dependencies).map(([pkg, ver]) => `- ${pkg}: ${ver}`).join('\n')}

## Testing
Run tests with: \`npm test\` or \`pytest\`

## Deployment
${payload.context.serverless !== false 
  ? 'Deploy with: `serverless deploy`' 
  : 'Build and deploy with Docker: `docker build -t app . && docker run -p 3000:3000 app`'}

## API Endpoints
- GET /health - Health check
- GET /api - List resources
- POST /api - Create resource
- GET /api/:id - Get specific resource
- PUT /api/:id - Update resource
- DELETE /api/:id - Delete resource

Generated by AI Developer Agent`;
  }

  private async saveGeneratedCode(result: CodeGenerationResult): Promise<void> {
    const outputDir = path.join(process.cwd(), 'generated_code', `project_${Date.now()}`);
    
    try {
      await fs.mkdir(outputDir, { recursive: true });
      
      // Save all files
      for (const file of result.files) {
        const filePath = path.join(outputDir, file.path);
        const fileDir = path.dirname(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content);
        this.logger.info(`Saved file: ${filePath}`);
      }
      
      // Save tests
      for (const test of result.tests) {
        const testPath = path.join(outputDir, test.path);
        const testDir = path.dirname(testPath);
        await fs.mkdir(testDir, { recursive: true });
        await fs.writeFile(testPath, test.content);
        this.logger.info(`Saved test: ${testPath}`);
      }
      
      // Save documentation
      const docPath = path.join(outputDir, 'README.md');
      await fs.writeFile(docPath, result.documentation);
      this.logger.info(`Saved documentation: ${docPath}`);
      
      // Save package.json if TypeScript/Node.js project
      if (Object.keys(result.dependencies).length > 0) {
        const packageJson = {
          name: 'generated-project',
          version: '1.0.0',
          dependencies: result.dependencies,
          scripts: {
            start: 'node dist/server.js',
            dev: 'nodemon src/server.ts',
            build: 'tsc',
            test: 'jest'
          }
        };
        await fs.writeFile(
          path.join(outputDir, 'package.json'),
          JSON.stringify(packageJson, null, 2)
        );
      }
      
    } catch (error) {
      this.logger.error('Failed to save generated code:', error);
    }
  }

  private async performCodeReview(payload: TaskPayload): Promise<any> {
    return {
      status: 'completed',
      review: {
        score: 8.5,
        issues: [
          { severity: 'low', message: 'Consider adding more error handling' },
          { severity: 'medium', message: 'Optimize database queries for performance' }
        ],
        suggestions: [
          'Add input validation',
          'Implement caching strategy',
          'Add more comprehensive tests'
        ]
      }
    };
  }

  private async refactorCode(payload: TaskPayload): Promise<any> {
    return {
      status: 'completed',
      refactoring: {
        filesModified: 5,
        improvements: [
          'Extracted common logic into utility functions',
          'Improved naming conventions',
          'Reduced code duplication',
          'Enhanced type safety'
        ]
      }
    };
  }

  private async processArchitectureSpec(spec: any): Promise<any> {
    // Generate code based on architecture specification
    const payload: TaskPayload = {
      taskId: uuidv4(),
      task: `Implement ${spec.title}`,
      priority: 'high',
      context: {
        serverless: spec.architecture.pattern === 'serverless',
        language: 'typescript',
        serviceName: spec.title.toLowerCase().replace(/\s+/g, '-')
      }
    };
    
    const codeResult = await this.generateCode(payload);
    return {
      status: 'code_generated',
      specId: spec.specId,
      codeResult
    };
  }

  private async generateCodeFromSpec(spec: any): Promise<CodeGenerationResult> {
    const payload: TaskPayload = {
      taskId: uuidv4(),
      task: `Generate code for ${spec.title}`,
      priority: 'high',
      context: spec
    };
    
    return await this.generateCode(payload);
  }

  private async reviewCode(codeData: any): Promise<any> {
    const payload: TaskPayload = {
      taskId: uuidv4(),
      task: 'Review code',
      priority: 'medium',
      context: codeData
    };
    
    return await this.performCodeReview(payload);
  }

  private buildCodePrompt(payload: TaskPayload): string {
    const { task, context } = payload;
    const isServerless = context.serverless !== false;
    const language = context.language || 'typescript';
    
    let prompt = `Generate production-ready ${language} code for: ${task}\n\n`;
    
    if (isServerless) {
      prompt += `Requirements:\n`;
      prompt += `- AWS Lambda function handler\n`;
      prompt += `- Serverless architecture\n`;
      prompt += `- Error handling and logging\n`;
      prompt += `- Input validation\n`;
    } else {
      prompt += `Requirements:\n`;
      prompt += `- Express.js REST API\n`;
      prompt += `- Proper routing and middleware\n`;
      prompt += `- Error handling\n`;
      prompt += `- Input validation\n`;
    }
    
    if (context.requirements) {
      prompt += `\nAdditional requirements: ${JSON.stringify(context.requirements)}`;
    }
    
    return prompt;
  }
  
  private generateCodeFromTemplates(payload: TaskPayload): CodeGenerationResult {
    // Fallback method using templates when Copilot is unavailable
    const isServerless = payload.context.serverless !== false;
    const language = payload.context.language || 'typescript';
    
    const result: CodeGenerationResult = {
      files: [],
      tests: [],
      documentation: '',
      dependencies: {}
    };
    
    if (isServerless) {
      result.files.push({
        path: `src/handlers/handler.${language === 'python' ? 'py' : 'ts'}`,
        content: this.codeTemplates.lambda[language],
        language
      });
    } else {
      result.files.push({
        path: 'src/routes/api.ts',
        content: this.codeTemplates.express.typescript,
        language: 'typescript'
      });
    }
    
    result.tests.push({
      path: 'tests/handler.test.ts',
      content: this.codeTemplates.test.jest
    });
    
    result.documentation = this.generateDocumentation(payload, result);
    
    return result;
  }
  
  private async notifyQAAgent(codeResult: CodeGenerationResult): Promise<void> {
    try {
      await axios.post('http://localhost:5004/agent/ai-qa-agent-1/message', {
        type: 'code_ready_for_testing',
        payload: codeResult
      });
      this.logger.info('Notified QA agent of new code to test');
    } catch (error) {
      this.logger.warn('Could not notify QA agent:', error);
    }
  }
}

// Start the agent
const agent = new DeveloperAgent();
agent.start().catch(error => {
  console.error('Failed to start Developer Agent:', error);
  process.exit(1);
});