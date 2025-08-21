import { BaseAgent, AgentConfig, TaskPayload, TaskResult } from '../lib/BaseAgent';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

interface TechnicalSpecification {
  specId: string;
  issueId: string;
  title: string;
  createdAt: string;
  requirements: any[];
  architecture: any;
  apiDesign: any;
  databaseDesign: any;
  technologyStack: Record<string, string[]>;
  deploymentStrategy: any;
  implementationRoadmap: any[];
  complexityScore: number;
  estimatedEffort: string;
  dependencies: string[];
  risks: any[];
}

class ArchitectAgent extends BaseAgent {
  private specifications: Map<string, TechnicalSpecification> = new Map();
  private architecturePatterns: Record<string, any> = {};
  private techRecommendations: Record<string, any> = {};

  constructor() {
    const config: AgentConfig = {
      id: 'ai-architect-agent-1',
      type: 'architect',
      name: 'AI Architect Agent',
      port: 5001,
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:4001',
      capabilities: [
        'system_architecture',
        'api_design',
        'database_design',
        'technology_selection',
        'integration_planning',
        'scalability_analysis',
        'security_architecture',
        'performance_optimization'
      ],
      awsBackendPolicy: {
        priorityOrder: [
          'AWS Lambda (serverless functions)',
          'AWS Fargate Tasks (Batch/Step Functions)',
          'AWS Fargate Container Service (ECS/EKS)',
          'EC2 (requires justification)'
        ],
        objectives: [
          'Scale to zero when idle',
          'Infinite auto-scaling capability',
          'Cost optimization - pay for usage only',
          'Minimal infrastructure management'
        ],
        defaultChoice: 'AWS Lambda'
      }
    };
    
    super(config);
    this.initializePatterns();
  }

  private initializePatterns(): void {
    this.architecturePatterns = {
      serverless_microservices: {
        description: 'AWS Lambda-based microservices with API Gateway',
        components: ['API Gateway', 'Lambda Functions', 'DynamoDB', 'S3'],
        scaling: 'Auto-scale to zero',
        costModel: 'Pay per request'
      },
      fargate_batch: {
        description: 'Containerized batch processing with Fargate',
        components: ['AWS Batch', 'Fargate', 'Step Functions', 'S3'],
        scaling: 'Scale to zero between jobs',
        costModel: 'Pay per execution time'
      },
      microservices: {
        whenToUse: ['scalability', 'independent_deployment', 'team_autonomy'],
        components: ['api_gateway', 'service_discovery', 'message_broker'],
        pros: ['scalability', 'fault_isolation', 'technology_diversity'],
        cons: ['complexity', 'network_overhead', 'data_consistency']
      },
      event_driven: {
        whenToUse: ['real_time', 'async_processing', 'loose_coupling'],
        components: ['event_bus', 'event_store', 'event_processors'],
        pros: ['loose_coupling', 'scalability', 'resilience'],
        cons: ['complexity', 'eventual_consistency', 'debugging']
      }
    };

    this.techRecommendations = {
      frontend: {
        web: {
          react: { useCases: ['spa', 'complex_ui', 'large_team'], ecosystem: 'excellent' },
          vue: { useCases: ['progressive', 'simple_ui', 'small_team'], ecosystem: 'good' },
          angular: { useCases: ['enterprise', 'full_framework', 'typescript'], ecosystem: 'excellent' }
        },
        mobile: {
          react_native: { useCases: ['cross_platform', 'react_team'], ecosystem: 'excellent' },
          flutter: { useCases: ['cross_platform', 'performance'], ecosystem: 'good' }
        }
      },
      backend: {
        nodejs: { useCases: ['real_time', 'api', 'microservices'], performance: 'good' },
        python: { useCases: ['ml', 'data_processing', 'rapid_development'], performance: 'moderate' },
        go: { useCases: ['performance', 'concurrent', 'microservices'], performance: 'excellent' }
      },
      database: {
        postgresql: { type: 'relational', useCases: ['complex_queries', 'acid', 'json'] },
        mongodb: { type: 'document', useCases: ['flexible_schema', 'scalability'] },
        redis: { type: 'key_value', useCases: ['caching', 'sessions', 'pub_sub'] },
        dynamodb: { type: 'nosql', useCases: ['serverless', 'scalability', 'aws_native'] }
      }
    };
  }

  protected async initialize(): Promise<void> {
    this.logger.info('Architect Agent initialized with AWS Serverless Policy');
    this.logger.info(`Capabilities: ${this.config.capabilities.join(', ')}`);
    
    // Create specifications directory
    const specsDir = path.join(process.cwd(), 'architecture_specs');
    try {
      await fs.mkdir(specsDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create specifications directory:', error);
    }
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('Architect Agent cleanup completed');
  }

  protected async handleTask(payload: TaskPayload): Promise<TaskResult> {
    this.logger.info(`Processing task: ${payload.task}`);
    this.status = 'busy';
    this.tasksInProgress++;

    try {
      const taskResult: TaskResult = {
        taskId: payload.taskId || uuidv4(),
        status: 'in_progress'
      };

      // Store task
      this.tasks.set(taskResult.taskId, taskResult);

      // Process based on task type
      if (payload.task.toLowerCase().includes('design') || 
          payload.task.toLowerCase().includes('architecture')) {
        
        const specification = await this.createArchitectureSpecification(payload);
        
        taskResult.status = 'completed';
        taskResult.result = specification;
        taskResult.completedAt = new Date().toISOString();
        
        // Save specification
        await this.saveSpecification(specification);
        
        // Update metrics
        this.tasksCompleted++;
        this.tasksInProgress--;
        
        // Notify developer agent if needed
        if (payload.context.notifyDeveloper) {
          await this.notifyDeveloperAgent(specification);
        }
      } else {
        // Default processing for other tasks
        taskResult.status = 'completed';
        taskResult.result = {
          message: 'Task processed successfully',
          analysis: await this.extractRequirements(payload.task)
        };
        taskResult.completedAt = new Date().toISOString();
        
        this.tasksCompleted++;
        this.tasksInProgress--;
      }

      this.status = 'idle';
      return taskResult;

    } catch (error) {
      this.tasksInProgress--;
      this.status = 'error';
      
      const errorResult: TaskResult = {
        taskId: payload.taskId || uuidv4(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      this.tasks.set(errorResult.taskId, errorResult);
      return errorResult;
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
      case 'analyze_issue':
        response = await this.analyzeGitHubIssue(message.payload);
        break;
      case 'get_specifications':
        response = Array.from(this.specifications.values());
        break;
      case 'get_recommendation':
        response = this.getTechnologyRecommendation(message.payload);
        break;
      default:
        response = {
          status: 'processed',
          message: `Architect agent processed message of type: ${message.type}`
        };
    }

    this.conversations.push({
      timestamp: new Date().toISOString(),
      type: 'sent',
      response
    });

    return response;
  }

  private async createArchitectureSpecification(payload: TaskPayload): Promise<TechnicalSpecification> {
    const spec: TechnicalSpecification = {
      specId: `arch-${Date.now()}-${uuidv4().substring(0, 6)}`,
      issueId: payload.context.issueId || 'unknown',
      title: payload.task,
      createdAt: new Date().toISOString(),
      requirements: await this.extractRequirements(payload.task),
      architecture: this.generateArchitectureDesign(payload),
      apiDesign: this.generateAPIDesign(payload),
      databaseDesign: this.generateDatabaseDesign(payload),
      technologyStack: this.recommendTechnologyStack(payload),
      deploymentStrategy: this.generateDeploymentStrategy(payload),
      implementationRoadmap: this.generateRoadmap(payload),
      complexityScore: this.calculateComplexity(payload),
      estimatedEffort: this.estimateEffort(payload),
      dependencies: this.identifyDependencies(payload),
      risks: this.identifyRisks(payload)
    };

    this.specifications.set(spec.specId, spec);
    return spec;
  }

  private async extractRequirements(task: string): Promise<any[]> {
    const requirements = [];
    
    // Simple pattern matching for requirements extraction
    const patterns = [
      { pattern: /should\s+(.+)/gi, type: 'functional' },
      { pattern: /must\s+(.+)/gi, type: 'mandatory' },
      { pattern: /needs?\s+to\s+(.+)/gi, type: 'functional' },
      { pattern: /support\s+(.+)/gi, type: 'feature' }
    ];

    for (const { pattern, type } of patterns) {
      const matches = task.matchAll(pattern);
      for (const match of matches) {
        requirements.push({
          type,
          description: match[1].trim(),
          priority: type === 'mandatory' ? 'high' : 'medium'
        });
      }
    }

    if (requirements.length === 0) {
      requirements.push({
        type: 'functional',
        description: task,
        priority: 'medium'
      });
    }

    return requirements;
  }

  private generateArchitectureDesign(payload: TaskPayload): any {
    const pattern = this.determineArchitecturePattern(payload);
    
    return {
      pattern: pattern.name,
      components: pattern.components,
      scalingStrategy: pattern.scaling,
      costModel: pattern.costModel,
      securityLayers: [
        { layer: 'Network', measures: ['VPC', 'Security Groups', 'WAF'] },
        { layer: 'Application', measures: ['JWT', 'RBAC', 'Input Validation'] },
        { layer: 'Data', measures: ['Encryption at rest', 'Encryption in transit'] }
      ]
    };
  }

  private determineArchitecturePattern(payload: TaskPayload): any {
    // AWS Backend Policy compliance
    if (payload.context.serverless !== false) {
      return this.architecturePatterns.serverless_microservices;
    }
    
    if (payload.context.batch || payload.task.toLowerCase().includes('batch')) {
      return this.architecturePatterns.fargate_batch;
    }
    
    if (payload.context.realTime || payload.task.toLowerCase().includes('real-time')) {
      return this.architecturePatterns.event_driven;
    }
    
    return this.architecturePatterns.microservices;
  }

  private generateAPIDesign(payload: TaskPayload): any {
    return {
      type: payload.context.apiType || 'REST',
      endpoints: [
        { method: 'GET', path: '/api/resources', description: 'List resources' },
        { method: 'POST', path: '/api/resources', description: 'Create resource' },
        { method: 'GET', path: '/api/resources/:id', description: 'Get resource' },
        { method: 'PUT', path: '/api/resources/:id', description: 'Update resource' },
        { method: 'DELETE', path: '/api/resources/:id', description: 'Delete resource' }
      ],
      authentication: 'JWT',
      rateLimit: '1000 requests per hour',
      versioning: 'URL path versioning (v1, v2)'
    };
  }

  private generateDatabaseDesign(payload: TaskPayload): any {
    const isServerless = !payload.context.serverless === false;
    
    return {
      type: isServerless ? 'NoSQL' : 'Relational',
      engine: isServerless ? 'DynamoDB' : 'PostgreSQL',
      schema: {
        tables: ['users', 'resources', 'audit_logs'],
        indexes: ['user_id', 'created_at', 'resource_type'],
        partitioning: payload.context.scale === 'large' ? 'enabled' : 'disabled'
      },
      backupStrategy: 'Daily automated backups with point-in-time recovery',
      replication: payload.context.scale === 'large' ? 'Multi-region' : 'Single-region'
    };
  }

  private recommendTechnologyStack(payload: TaskPayload): Record<string, string[]> {
    const isServerless = !payload.context.serverless === false;
    
    return {
      frontend: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
      backend: isServerless 
        ? ['AWS Lambda', 'API Gateway', 'TypeScript']
        : ['Node.js', 'Express', 'TypeScript'],
      database: isServerless
        ? ['DynamoDB', 'ElastiCache']
        : ['PostgreSQL', 'Redis'],
      infrastructure: isServerless
        ? ['AWS SAM', 'CloudFormation', 'S3', 'CloudFront']
        : ['Docker', 'Kubernetes', 'Terraform'],
      monitoring: ['CloudWatch', 'X-Ray', 'Grafana'],
      cicd: ['GitHub Actions', 'AWS CodePipeline']
    };
  }

  private generateDeploymentStrategy(payload: TaskPayload): any {
    return {
      environments: ['development', 'staging', 'production'],
      strategy: payload.context.scale === 'large' ? 'Blue-Green' : 'Rolling',
      automation: 'GitOps with ArgoCD',
      rollback: 'Automatic rollback on failure',
      monitoring: 'Real-time monitoring with alerts'
    };
  }

  private generateRoadmap(_payload: TaskPayload): any[] {
    return [
      {
        phase: 1,
        name: 'Foundation',
        duration: '1 week',
        tasks: ['Setup development environment', 'Initialize project', 'Configure CI/CD']
      },
      {
        phase: 2,
        name: 'Core Development',
        duration: '2-3 weeks',
        tasks: ['Implement core features', 'Database setup', 'API development']
      },
      {
        phase: 3,
        name: 'Integration & Testing',
        duration: '1 week',
        tasks: ['Integration testing', 'Performance testing', 'Security testing']
      },
      {
        phase: 4,
        name: 'Deployment',
        duration: '3 days',
        tasks: ['Deploy to staging', 'User acceptance testing', 'Production deployment']
      }
    ];
  }

  private calculateComplexity(payload: TaskPayload): number {
    let score = 5; // Base complexity
    
    if (payload.context.scale === 'large') score += 2;
    if (payload.context.integrations?.length > 3) score += 1;
    if (payload.context.realTime) score += 1;
    if (payload.context.ml) score += 1;
    
    return Math.min(10, score);
  }

  private estimateEffort(payload: TaskPayload): string {
    const complexity = this.calculateComplexity(payload);
    
    if (complexity <= 3) return '1 week';
    if (complexity <= 5) return '2-3 weeks';
    if (complexity <= 7) return '4-6 weeks';
    return '2-3 months';
  }

  private identifyDependencies(payload: TaskPayload): string[] {
    const deps = ['npm packages', 'AWS services'];
    
    if (payload.context.integrations) {
      deps.push(...payload.context.integrations);
    }
    
    return deps;
  }

  private identifyRisks(payload: TaskPayload): any[] {
    const risks = [];
    
    if (payload.context.scale === 'large') {
      risks.push({
        type: 'scalability',
        description: 'High traffic may require additional scaling',
        mitigation: 'Implement auto-scaling and load testing'
      });
    }
    
    if (payload.context.realTime) {
      risks.push({
        type: 'performance',
        description: 'Real-time requirements may impact latency',
        mitigation: 'Use WebSockets and optimize data flow'
      });
    }
    
    return risks;
  }

  private async saveSpecification(spec: TechnicalSpecification): Promise<void> {
    const specsDir = path.join(process.cwd(), 'architecture_specs');
    const filePath = path.join(specsDir, `${spec.specId}.json`);
    
    try {
      await fs.writeFile(filePath, JSON.stringify(spec, null, 2));
      this.logger.info(`Saved specification to ${filePath}`);
    } catch (error) {
      this.logger.error('Failed to save specification:', error);
    }
  }

  private async notifyDeveloperAgent(spec: TechnicalSpecification): Promise<void> {
    try {
      await axios.post('http://localhost:5002/agent/ai-developer-agent-1/message', {
        type: 'architecture_ready',
        payload: spec
      });
      this.logger.info('Notified developer agent of new specification');
    } catch (error) {
      this.logger.warn('Could not notify developer agent:', error);
    }
  }

  private async analyzeGitHubIssue(issue: any): Promise<any> {
    return {
      issueId: issue.id,
      analysis: {
        requirements: await this.extractRequirements(issue.body || issue.title),
        suggestedArchitecture: this.architecturePatterns.serverless_microservices,
        estimatedComplexity: 5,
        estimatedEffort: '2-3 weeks'
      }
    };
  }

  private getTechnologyRecommendation(context: any): any {
    const recommendations = {
      frontend: context.mobile ? this.techRecommendations.frontend.mobile : this.techRecommendations.frontend.web,
      backend: this.techRecommendations.backend,
      database: this.techRecommendations.database
    };
    
    return recommendations;
  }
}

// Start the agent
const agent = new ArchitectAgent();
agent.start().catch(error => {
  console.error('Failed to start Architect Agent:', error);
  process.exit(1);
});