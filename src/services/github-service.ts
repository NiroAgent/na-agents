import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import * as path from 'path';
import winston from 'winston';
import express, { Request, Response, Express } from 'express';
import crypto from 'crypto';
import axios from 'axios';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  labels: Array<{ name: string; color: string; description?: string }>;
  assignees: Array<{ login: string; id: number }>;
  user: { login: string; id: number };
  created_at: string;
  updated_at: string;
  html_url: string;
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
  };
}

interface AgentAssignment {
  agentType: 'architect' | 'developer' | 'devops' | 'qa' | 'manager';
  priority: 'low' | 'medium' | 'high';
  reason: string;
  confidence: number;
}

class GitHubIntegrationService {
  private octokit: Octokit;
  private logger: winston.Logger;
  private webhookSecret: string;
  private app: Express;
  private port: number;
  
  // Agent endpoint mappings
  private agentEndpoints = {
    architect: 'http://localhost:5001',
    developer: 'http://localhost:5002', 
    devops: 'http://localhost:5003',
    qa: 'http://localhost:5004',
    manager: 'http://localhost:5005'
  };

  // Label to agent mapping
  private labelMappings: Record<string, AgentAssignment> = {
    // Architecture & Design
    'architecture': { agentType: 'architect', priority: 'high', reason: 'Architecture design required', confidence: 0.95 },
    'design': { agentType: 'architect', priority: 'high', reason: 'System design needed', confidence: 0.90 },
    'technical-spec': { agentType: 'architect', priority: 'high', reason: 'Technical specification required', confidence: 0.95 },
    
    // Development
    'bug': { agentType: 'developer', priority: 'high', reason: 'Bug fix implementation', confidence: 0.90 },
    'feature': { agentType: 'developer', priority: 'medium', reason: 'Feature development', confidence: 0.85 },
    'enhancement': { agentType: 'developer', priority: 'medium', reason: 'Enhancement implementation', confidence: 0.80 },
    'refactoring': { agentType: 'developer', priority: 'low', reason: 'Code refactoring', confidence: 0.75 },
    
    // DevOps & Infrastructure
    'deployment': { agentType: 'devops', priority: 'high', reason: 'Deployment required', confidence: 0.95 },
    'infrastructure': { agentType: 'devops', priority: 'high', reason: 'Infrastructure work', confidence: 0.90 },
    'ci/cd': { agentType: 'devops', priority: 'medium', reason: 'CI/CD pipeline work', confidence: 0.85 },
    'docker': { agentType: 'devops', priority: 'medium', reason: 'Container work', confidence: 0.80 },
    'kubernetes': { agentType: 'devops', priority: 'medium', reason: 'Kubernetes deployment', confidence: 0.85 },
    
    // Quality Assurance
    'testing': { agentType: 'qa', priority: 'high', reason: 'Testing required', confidence: 0.95 },
    'quality': { agentType: 'qa', priority: 'high', reason: 'Quality assurance needed', confidence: 0.90 },
    'performance': { agentType: 'qa', priority: 'medium', reason: 'Performance testing', confidence: 0.85 },
    'security': { agentType: 'qa', priority: 'high', reason: 'Security testing required', confidence: 0.90 },
    
    // Management
    'strategy': { agentType: 'manager', priority: 'high', reason: 'Strategic planning', confidence: 0.95 },
    'planning': { agentType: 'manager', priority: 'medium', reason: 'Project planning', confidence: 0.80 },
    'coordination': { agentType: 'manager', priority: 'medium', reason: 'Team coordination needed', confidence: 0.85 },
    'escalation': { agentType: 'manager', priority: 'high', reason: 'Issue escalation', confidence: 0.95 }
  };

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
      userAgent: 'na-agents/1.0'
    });

    this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET || 'default-secret';
    this.port = parseInt(process.env.GITHUB_SERVICE_PORT || '6000');
    this.app = express();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [GitHubService] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/github-service.log' })
      ]
    });

    this.setupWebhookServer();
    this.logger.info('GitHub Integration Service initialized');
  }

  private setupWebhookServer(): void {
    this.app.use(express.raw({ type: 'application/json' }));
    
    // Webhook endpoint
    this.app.post('/webhook', this.handleWebhook.bind(this));
    
    // Health check
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'healthy', service: 'GitHub Integration' });
    });
    
    // Manual trigger endpoint for testing
    this.app.post('/trigger/:owner/:repo/:issueNumber', this.handleManualTrigger.bind(this));
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        this.logger.info(`GitHub webhook server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  private async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Verify webhook signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!this.verifyWebhookSignature(req.body, signature)) {
        res.status(401).send('Unauthorized');
        return;
      }

      const event = req.headers['x-github-event'] as string;
      const payload = JSON.parse(req.body.toString());

      this.logger.info(`Received GitHub webhook: ${event}`);

      switch (event) {
        case 'issues':
          await this.handleIssueEvent(payload);
          break;
        case 'issue_comment':
          await this.handleIssueCommentEvent(payload);
          break;
        case 'pull_request':
          await this.handlePullRequestEvent(payload);
          break;
        case 'push':
          await this.handlePushEvent(payload);
          break;
        default:
          this.logger.info(`Unhandled GitHub event: ${event}`);
      }

      res.status(200).send('OK');
    } catch (error) {
      this.logger.error('Error handling webhook:', error);
      res.status(500).send('Internal Server Error');
    }
  }

  private async handleManualTrigger(req: Request, res: Response): Promise<void> {
    try {
      const { owner, repo, issueNumber } = req.params;
      
      // Fetch issue from GitHub
      const { data: issue } = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: parseInt(issueNumber)
      });

      // Process the issue
      await this.processIssue({
        ...issue,
        repository: { name: repo, full_name: `${owner}/${repo}`, owner: { login: owner } }
      } as GitHubIssue);

      res.json({ 
        status: 'processed', 
        issue: issue.number,
        title: issue.title 
      });
    } catch (error) {
      this.logger.error('Error in manual trigger:', error);
      res.status(500).json({ error: 'Failed to process issue' });
    }
  }

  private verifyWebhookSignature(payload: Buffer, signature: string): boolean {
    if (!signature) return false;
    
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private async handleIssueEvent(payload: any): Promise<void> {
    const { action, issue, repository } = payload;
    
    if (action === 'opened' || action === 'labeled' || action === 'edited') {
      const githubIssue: GitHubIssue = {
        ...issue,
        repository: {
          name: repository.name,
          full_name: repository.full_name,
          owner: { login: repository.owner.login }
        }
      };
      
      await this.processIssue(githubIssue);
    }
  }

  private async handleIssueCommentEvent(payload: any): Promise<void> {
    const { action, comment, issue, repository } = payload;
    
    if (action === 'created') {
      // Check if comment contains agent instructions
      const commentBody = comment.body.toLowerCase();
      const agentMentions = this.extractAgentMentions(commentBody);
      
      if (agentMentions.length > 0) {
        this.logger.info(`Agent mentions found in comment: ${agentMentions.join(', ')}`);
        
        for (const agentType of agentMentions) {
          await this.sendTaskToAgent(agentType as any, {
            taskId: `comment-${comment.id}`,
            task: `Process comment on issue #${issue.number}: ${comment.body}`,
            priority: 'medium',
            context: {
              issueNumber: issue.number,
              repository: repository.full_name,
              commentId: comment.id,
              commentAuthor: comment.user.login,
              issueTitle: issue.title
            }
          });
        }
      }
    }
  }

  private async handlePullRequestEvent(payload: any): Promise<void> {
    const { action, pull_request } = payload;
    
    if (action === 'opened' || action === 'ready_for_review') {
      // Send to QA agent for review
      await this.sendTaskToAgent('qa', {
        taskId: `pr-${pull_request.id}`,
        task: `Review pull request: ${pull_request.title}`,
        priority: 'high',
        context: {
          pullRequestNumber: pull_request.number,
          repository: pull_request.base.repo.full_name,
          author: pull_request.user.login,
          branch: pull_request.head.ref
        }
      });
    }
  }

  private async handlePushEvent(payload: any): Promise<void> {
    const { ref, repository, commits } = payload;
    
    // Only process pushes to main/master branch
    if (ref === 'refs/heads/main' || ref === 'refs/heads/master') {
      // Send to DevOps agent for deployment consideration
      await this.sendTaskToAgent('devops', {
        taskId: `push-${payload.head_commit.id}`,
        task: `Process push to ${ref}: ${commits.length} commits`,
        priority: 'medium',
        context: {
          repository: repository.full_name,
          branch: ref.replace('refs/heads/', ''),
          commits: commits.map((c: any) => ({
            id: c.id,
            message: c.message,
            author: c.author.name
          }))
        }
      });
    }
  }

  private async processIssue(issue: GitHubIssue): Promise<void> {
    this.logger.info(`Processing issue #${issue.number}: ${issue.title}`);
    
    // Determine which agent should handle this issue
    const assignment = this.determineAgentAssignment(issue);
    
    if (!assignment) {
      this.logger.warn(`No agent assignment found for issue #${issue.number}`);
      return;
    }
    
    this.logger.info(`Assigning issue #${issue.number} to ${assignment.agentType} (confidence: ${assignment.confidence})`);
    
    // Send task to assigned agent
    await this.sendTaskToAgent(assignment.agentType, {
      taskId: `issue-${issue.id}`,
      task: `${issue.title}\n\n${issue.body}`,
      priority: assignment.priority,
      context: {
        issueNumber: issue.number,
        repository: issue.repository.full_name,
        labels: issue.labels.map(l => l.name),
        author: issue.user.login,
        htmlUrl: issue.html_url,
        assignmentReason: assignment.reason
      }
    });
    
    // Update issue with agent assignment comment
    await this.addIssueComment(issue, `🤖 **Agent Assignment**\n\nThis issue has been assigned to the **${assignment.agentType.toUpperCase()} Agent**.\n\n**Reason**: ${assignment.reason}\n**Priority**: ${assignment.priority}\n**Confidence**: ${(assignment.confidence * 100).toFixed(1)}%\n\nThe agent will process this issue and provide updates as needed.`);
    
    // Add appropriate labels
    await this.addIssueLabels(issue, [`agent:${assignment.agentType}`, `priority:${assignment.priority}`]);
  }

  private determineAgentAssignment(issue: GitHubIssue): AgentAssignment | null {
    let bestAssignment: AgentAssignment | null = null;
    let highestConfidence = 0;
    
    // Check label-based assignments first (highest confidence)
    for (const label of issue.labels) {
      const labelName = label.name.toLowerCase();
      const assignment = this.labelMappings[labelName];
      
      if (assignment && assignment.confidence > highestConfidence) {
        bestAssignment = assignment;
        highestConfidence = assignment.confidence;
      }
    }
    
    // If no label match, use content-based analysis
    if (!bestAssignment) {
      bestAssignment = this.analyzeIssueContent(issue);
    }
    
    return bestAssignment;
  }

  private analyzeIssueContent(issue: GitHubIssue): AgentAssignment | null {
    const content = `${issue.title} ${issue.body}`.toLowerCase();
    
    // Architecture keywords
    if (this.containsKeywords(content, ['architecture', 'design', 'system', 'spec', 'technical', 'integration'])) {
      return { agentType: 'architect', priority: 'medium', reason: 'Architecture-related content detected', confidence: 0.70 };
    }
    
    // Development keywords
    if (this.containsKeywords(content, ['bug', 'fix', 'implement', 'feature', 'code', 'function', 'method'])) {
      return { agentType: 'developer', priority: 'medium', reason: 'Development work detected', confidence: 0.65 };
    }
    
    // DevOps keywords
    if (this.containsKeywords(content, ['deploy', 'docker', 'kubernetes', 'ci', 'cd', 'pipeline', 'infrastructure'])) {
      return { agentType: 'devops', priority: 'medium', reason: 'DevOps work detected', confidence: 0.65 };
    }
    
    // QA keywords
    if (this.containsKeywords(content, ['test', 'testing', 'qa', 'quality', 'performance', 'security', 'bug'])) {
      return { agentType: 'qa', priority: 'medium', reason: 'Quality assurance work detected', confidence: 0.60 };
    }
    
    // Management keywords
    if (this.containsKeywords(content, ['strategy', 'planning', 'coordination', 'management', 'escalation'])) {
      return { agentType: 'manager', priority: 'medium', reason: 'Management work detected', confidence: 0.60 };
    }
    
    // Default to developer for general issues
    return { agentType: 'developer', priority: 'low', reason: 'Default assignment - general issue', confidence: 0.30 };
  }

  private containsKeywords(content: string, keywords: string[]): boolean {
    return keywords.some(keyword => content.includes(keyword));
  }

  private extractAgentMentions(comment: string): string[] {
    const mentions = [];
    const agentTypes = ['architect', 'developer', 'devops', 'qa', 'manager'];
    
    for (const agentType of agentTypes) {
      if (comment.includes(`@${agentType}`) || comment.includes(`@${agentType}-agent`)) {
        mentions.push(agentType);
      }
    }
    
    return mentions;
  }

  private async sendTaskToAgent(agentType: string, taskPayload: any): Promise<void> {
    try {
      const endpoint = this.agentEndpoints[agentType as keyof typeof this.agentEndpoints];
      if (!endpoint) {
        this.logger.error(`Unknown agent type: ${agentType}`);
        return;
      }
      
      const agentUrl = `${endpoint}/agent/ai-${agentType}-agent-1/task`;
      
      const response = await axios.post(agentUrl, taskPayload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'na-agents-github-service/1.0'
        }
      });
      
      this.logger.info(`Task sent to ${agentType} agent: ${response.status}`);
    } catch (error) {
      this.logger.error(`Failed to send task to ${agentType} agent:`, error);
    }
  }

  private async addIssueComment(issue: GitHubIssue, comment: string): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
        issue_number: issue.number,
        body: comment
      });
      
      this.logger.info(`Added comment to issue #${issue.number}`);
    } catch (error) {
      this.logger.error(`Failed to add comment to issue #${issue.number}:`, error);
    }
  }

  private async addIssueLabels(issue: GitHubIssue, labels: string[]): Promise<void> {
    try {
      await this.octokit.rest.issues.addLabels({
        owner: issue.repository.owner.login,
        repo: issue.repository.name,
        issue_number: issue.number,
        labels
      });
      
      this.logger.info(`Added labels to issue #${issue.number}: ${labels.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to add labels to issue #${issue.number}:`, error);
    }
  }

  public async createIssueFromTask(task: {
    repository: string;
    title: string;
    body: string;
    labels?: string[];
    assignees?: string[];
  }): Promise<number | null> {
    try {
      const [owner, repo] = task.repository.split('/');
      
      const { data: issue } = await this.octokit.rest.issues.create({
        owner,
        repo,
        title: task.title,
        body: task.body,
        labels: task.labels,
        assignees: task.assignees
      });
      
      this.logger.info(`Created issue #${issue.number} in ${task.repository}`);
      return issue.number;
    } catch (error) {
      this.logger.error('Failed to create issue:', error);
      return null;
    }
  }

  public async updateIssueStatus(
    repository: string,
    issueNumber: number,
    status: 'completed' | 'in-progress' | 'failed',
    comment?: string
  ): Promise<void> {
    try {
      const [owner, repo] = repository.split('/');
      
      // Add status comment
      const statusComment = `🤖 **Agent Update**\n\nStatus: **${status.toUpperCase()}**\n\n${comment || 'No additional details provided.'}`;
      
      await this.addIssueComment({
        repository: { owner: { login: owner }, name: repo },
        number: issueNumber
      } as GitHubIssue, statusComment);
      
      // Close issue if completed
      if (status === 'completed') {
        await this.octokit.rest.issues.update({
          owner,
          repo,
          issue_number: issueNumber,
          state: 'closed',
          state_reason: 'completed'
        });
      }
      
      this.logger.info(`Updated issue #${issueNumber} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update issue status:`, error);
    }
  }
}

// Singleton instance
export const githubService = new GitHubIntegrationService();

// Export the class for testing
export { GitHubIntegrationService };