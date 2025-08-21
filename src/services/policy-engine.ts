import * as fs from 'fs/promises';
import * as path from 'path';
import * as sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import winston from 'winston';

interface AgentRole {
  roleId: string;
  name: string;
  description: string;
  responsibilities: string[];
  policies: string[];
  knowledgeBaseRefs: string[];
  standards: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  approvalRequired: boolean;
}

interface PolicyRule {
  ruleId: string;
  name: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  action: string;
  mitigation: string;
  applicableRoles: string[];
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseEntry {
  entryId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  applicableRoles: string[];
  source: string;
  lastUpdated: string;
  version: string;
}

interface PolicyAssessment {
  assessmentId: string;
  agentId: string;
  roleId: string;
  content: string;
  timestamp: string;
  passed: boolean;
  violations: Array<{
    ruleId: string;
    severity: string;
    description: string;
    recommendation: string;
  }>;
  assessmentSummary: string;
  recommendations: string[];
}

class AgentPolicyEngine {
  private db!: Database;
  private logger: winston.Logger;
  private roles: Map<string, AgentRole> = new Map();
  private rules: Map<string, PolicyRule> = new Map();
  private knowledgeBase: Map<string, KnowledgeBaseEntry> = new Map();

  constructor(dbPath: string = './agent_policies.db') {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [PolicyEngine] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/policy-engine.log' })
      ]
    });

    this.initializeDatabase(dbPath);
    this.loadDefaultPolicies();
  }

  private async initializeDatabase(dbPath: string): Promise<void> {
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Create tables
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_roles (
        role_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        responsibilities TEXT,
        policies TEXT,
        knowledge_base_refs TEXT,
        standards TEXT,
        risk_level TEXT,
        approval_required BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS policy_rules (
        rule_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        severity TEXT,
        pattern TEXT,
        action TEXT,
        mitigation TEXT,
        applicable_roles TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS knowledge_base (
        entry_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT,
        tags TEXT,
        applicable_roles TEXT,
        source TEXT,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        version TEXT
      );

      CREATE TABLE IF NOT EXISTS assessments (
        assessment_id TEXT PRIMARY KEY,
        agent_id TEXT,
        role_id TEXT,
        content_hash TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        passed BOOLEAN,
        violations TEXT,
        assessment_summary TEXT,
        recommendations TEXT
      );
    `);

    this.logger.info('Policy engine database initialized');
  }

  private async loadDefaultPolicies(): Promise<void> {
    // AWS Backend Policy - Mandatory for all agents
    const awsBackendRole: AgentRole = {
      roleId: 'aws-serverless-policy',
      name: 'AWS Serverless-First Policy',
      description: 'Mandatory AWS serverless architecture compliance',
      responsibilities: [
        'Prioritize AWS Lambda for all backend processing',
        'Use Fargate for containerized workloads',
        'Avoid EC2 unless justified',
        'Scale to zero when idle',
        'Optimize for cost efficiency'
      ],
      policies: [
        'aws-lambda-priority',
        'fargate-containers',
        'no-ec2-default',
        'cost-optimization'
      ],
      knowledgeBaseRefs: [
        'aws-lambda-best-practices',
        'fargate-deployment-guide',
        'cost-optimization-strategies'
      ],
      standards: {
        'lambda_runtime': 'nodejs18.x',
        'timeout_max': 900,
        'memory_range': [128, 10240],
        'concurrent_executions': 1000
      },
      riskLevel: 'high',
      approvalRequired: true
    };

    // Agent-specific roles
    const architectRole: AgentRole = {
      roleId: 'architect-agent',
      name: 'AI Architect Agent Role',
      description: 'Technical architecture and system design',
      responsibilities: [
        'Create technical specifications',
        'Design system architecture',
        'Select appropriate technologies',
        'Ensure scalability and security'
      ],
      policies: [
        'aws-serverless-policy',
        'security-by-design',
        'scalability-requirements'
      ],
      knowledgeBaseRefs: [
        'architecture-patterns',
        'security-guidelines',
        'scalability-best-practices'
      ],
      standards: {
        'spec_format': 'json',
        'required_sections': ['architecture', 'api_design', 'database_design'],
        'complexity_scoring': true
      },
      riskLevel: 'medium',
      approvalRequired: false
    };

    const developerRole: AgentRole = {
      roleId: 'developer-agent',
      name: 'AI Developer Agent Role',
      description: 'Code generation and implementation',
      responsibilities: [
        'Generate production-ready code',
        'Follow coding standards',
        'Implement security best practices',
        'Create comprehensive tests'
      ],
      policies: [
        'aws-serverless-policy',
        'code-quality-standards',
        'security-coding-practices'
      ],
      knowledgeBaseRefs: [
        'coding-standards',
        'security-coding-guidelines',
        'testing-best-practices'
      ],
      standards: {
        'code_coverage': 80,
        'max_function_length': 50,
        'typescript_strict': true
      },
      riskLevel: 'high',
      approvalRequired: false
    };

    // Store roles
    await this.createRole(awsBackendRole);
    await this.createRole(architectRole);
    await this.createRole(developerRole);

    // Load default policy rules
    await this.loadDefaultPolicyRules();
    await this.loadDefaultKnowledgeBase();
  }

  private async loadDefaultPolicyRules(): Promise<void> {
    const rules: PolicyRule[] = [
      {
        ruleId: 'aws-lambda-priority',
        name: 'AWS Lambda Priority Rule',
        description: 'Lambda must be the first choice for backend processing',
        category: 'architecture',
        severity: 'high',
        pattern: 'backend|processing|api|function',
        action: 'require_lambda_justification',
        mitigation: 'Use AWS Lambda unless specific requirements prevent it',
        applicableRoles: ['architect-agent', 'developer-agent', 'devops-agent'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        ruleId: 'no-hardcoded-secrets',
        name: 'No Hardcoded Secrets',
        description: 'Code must not contain hardcoded API keys, passwords, or secrets',
        category: 'security',
        severity: 'critical',
        pattern: '(api[_-]?key|password|secret|token)\\s*[=:]\\s*["\'][^"\']+["\']',
        action: 'block_deployment',
        mitigation: 'Use environment variables or AWS Secrets Manager',
        applicableRoles: ['developer-agent'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        ruleId: 'typescript-strict-mode',
        name: 'TypeScript Strict Mode',
        description: 'TypeScript code must use strict mode',
        category: 'code_quality',
        severity: 'medium',
        pattern: 'tsconfig\\.json',
        action: 'enforce_strict_mode',
        mitigation: 'Enable strict mode in tsconfig.json',
        applicableRoles: ['developer-agent'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    for (const rule of rules) {
      await this.createPolicyRule(rule);
    }
  }

  private async loadDefaultKnowledgeBase(): Promise<void> {
    const entries: KnowledgeBaseEntry[] = [
      {
        entryId: 'aws-lambda-best-practices',
        title: 'AWS Lambda Best Practices',
        content: `
# AWS Lambda Best Practices

## Function Design
- Keep functions small and focused on single responsibility
- Use environment variables for configuration
- Implement proper error handling and retries
- Optimize cold start performance

## Memory and Timeout
- Set appropriate memory allocation (128MB - 10GB)
- Configure timeout based on function requirements
- Monitor execution duration and optimize

## Security
- Use least privilege IAM roles
- Enable VPC if needed for database access
- Use AWS Secrets Manager for sensitive data
        `,
        category: 'aws',
        tags: ['lambda', 'serverless', 'best-practices'],
        applicableRoles: ['architect-agent', 'developer-agent', 'devops-agent'],
        source: 'AWS Documentation',
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      },
      {
        entryId: 'security-coding-guidelines',
        title: 'Secure Coding Guidelines',
        content: `
# Secure Coding Guidelines

## Input Validation
- Validate all user inputs
- Use parameterized queries for database access
- Sanitize data before processing

## Authentication & Authorization
- Implement proper authentication mechanisms
- Use JWT tokens with appropriate expiration
- Implement role-based access control

## Data Protection
- Encrypt sensitive data at rest and in transit
- Use HTTPS for all communications
- Never log sensitive information
        `,
        category: 'security',
        tags: ['security', 'coding', 'guidelines'],
        applicableRoles: ['developer-agent'],
        source: 'OWASP',
        lastUpdated: new Date().toISOString(),
        version: '1.0'
      }
    ];

    for (const entry of entries) {
      await this.createKnowledgeBaseEntry(entry);
    }
  }

  public async assessAgentAction(
    agentId: string,
    roleId: string,
    content: string
  ): Promise<PolicyAssessment> {
    this.logger.info(`Assessing action for agent ${agentId} with role ${roleId}`);

    const violations = await this.checkPolicyViolations(content, roleId);
    const passed = violations.length === 0;
    
    const assessment: PolicyAssessment = {
      assessmentId: `assess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      agentId,
      roleId,
      content: this.hashContent(content),
      timestamp: new Date().toISOString(),
      passed,
      violations,
      assessmentSummary: this.generateAssessmentSummary(passed, violations),
      recommendations: this.generateRecommendations(violations)
    };

    // Store assessment
    await this.storeAssessment(assessment);

    return assessment;
  }

  private async checkPolicyViolations(
    content: string,
    roleId: string
  ): Promise<Array<{
    ruleId: string;
    severity: string;
    description: string;
    recommendation: string;
  }>> {
    const violations = [];
    const applicableRules = await this.getRulesForRole(roleId);

    for (const rule of applicableRules) {
      try {
        const regex = new RegExp(rule.pattern, 'gi');
        if (regex.test(content)) {
          violations.push({
            ruleId: rule.ruleId,
            severity: rule.severity,
            description: rule.description,
            recommendation: rule.mitigation
          });
        }
      } catch (error) {
        this.logger.warn(`Invalid regex pattern in rule ${rule.ruleId}: ${rule.pattern}`);
      }
    }

    return violations;
  }

  private async getRulesForRole(roleId: string): Promise<PolicyRule[]> {
    const query = `
      SELECT * FROM policy_rules 
      WHERE applicable_roles LIKE '%${roleId}%'
    `;
    
    const rows = await this.db.all(query);
    return rows.map(row => ({
      ruleId: row.rule_id,
      name: row.name,
      description: row.description,
      category: row.category,
      severity: row.severity,
      pattern: row.pattern,
      action: row.action,
      mitigation: row.mitigation,
      applicableRoles: JSON.parse(row.applicable_roles || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  private hashContent(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private generateAssessmentSummary(passed: boolean, violations: any[]): string {
    if (passed) {
      return 'Policy compliance check passed - no violations found';
    }
    
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const highCount = violations.filter(v => v.severity === 'high').length;
    const mediumCount = violations.filter(v => v.severity === 'medium').length;
    const lowCount = violations.filter(v => v.severity === 'low').length;

    return `Policy violations found: ${criticalCount} critical, ${highCount} high, ${mediumCount} medium, ${lowCount} low`;
  }

  private generateRecommendations(violations: any[]): string[] {
    const recommendations = [];
    
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push('Address critical security violations immediately before deployment');
    }
    
    const highViolations = violations.filter(v => v.severity === 'high');
    if (highViolations.length > 0) {
      recommendations.push('Resolve high-priority violations to ensure compliance');
    }
    
    if (violations.some(v => v.ruleId.includes('aws-lambda'))) {
      recommendations.push('Review AWS serverless architecture requirements');
    }
    
    return recommendations;
  }

  private async storeAssessment(assessment: PolicyAssessment): Promise<void> {
    const query = `
      INSERT INTO assessments (
        assessment_id, agent_id, role_id, content_hash, timestamp,
        passed, violations, assessment_summary, recommendations
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      assessment.assessmentId,
      assessment.agentId,
      assessment.roleId,
      assessment.content,
      assessment.timestamp,
      assessment.passed ? 1 : 0,
      JSON.stringify(assessment.violations),
      assessment.assessmentSummary,
      JSON.stringify(assessment.recommendations)
    ]);
  }

  public async createRole(role: AgentRole): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO agent_roles (
        role_id, name, description, responsibilities, policies,
        knowledge_base_refs, standards, risk_level, approval_required
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      role.roleId,
      role.name,
      role.description,
      JSON.stringify(role.responsibilities),
      JSON.stringify(role.policies),
      JSON.stringify(role.knowledgeBaseRefs),
      JSON.stringify(role.standards),
      role.riskLevel,
      role.approvalRequired ? 1 : 0
    ]);
    
    this.roles.set(role.roleId, role);
    this.logger.info(`Created/updated role: ${role.roleId}`);
  }

  public async createPolicyRule(rule: PolicyRule): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO policy_rules (
        rule_id, name, description, category, severity,
        pattern, action, mitigation, applicable_roles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      rule.ruleId,
      rule.name,
      rule.description,
      rule.category,
      rule.severity,
      rule.pattern,
      rule.action,
      rule.mitigation,
      JSON.stringify(rule.applicableRoles)
    ]);
    
    this.rules.set(rule.ruleId, rule);
    this.logger.info(`Created/updated policy rule: ${rule.ruleId}`);
  }

  public async createKnowledgeBaseEntry(entry: KnowledgeBaseEntry): Promise<void> {
    const query = `
      INSERT OR REPLACE INTO knowledge_base (
        entry_id, title, content, category, tags,
        applicable_roles, source, version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.db.run(query, [
      entry.entryId,
      entry.title,
      entry.content,
      entry.category,
      JSON.stringify(entry.tags),
      JSON.stringify(entry.applicableRoles),
      entry.source,
      entry.version
    ]);
    
    this.knowledgeBase.set(entry.entryId, entry);
    this.logger.info(`Created/updated knowledge base entry: ${entry.entryId}`);
  }

  public async getRole(roleId: string): Promise<AgentRole | null> {
    if (this.roles.has(roleId)) {
      return this.roles.get(roleId)!;
    }
    
    const query = 'SELECT * FROM agent_roles WHERE role_id = ?';
    const row = await this.db.get(query, roleId);
    
    if (!row) return null;
    
    const role: AgentRole = {
      roleId: row.role_id,
      name: row.name,
      description: row.description,
      responsibilities: JSON.parse(row.responsibilities || '[]'),
      policies: JSON.parse(row.policies || '[]'),
      knowledgeBaseRefs: JSON.parse(row.knowledge_base_refs || '[]'),
      standards: JSON.parse(row.standards || '{}'),
      riskLevel: row.risk_level,
      approvalRequired: row.approval_required === 1
    };
    
    this.roles.set(roleId, role);
    return role;
  }

  public async getKnowledgeForRole(roleId: string): Promise<KnowledgeBaseEntry[]> {
    const query = `
      SELECT * FROM knowledge_base 
      WHERE applicable_roles LIKE '%${roleId}%'
    `;
    
    const rows = await this.db.all(query);
    return rows.map(row => ({
      entryId: row.entry_id,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: JSON.parse(row.tags || '[]'),
      applicableRoles: JSON.parse(row.applicable_roles || '[]'),
      source: row.source,
      lastUpdated: row.last_updated,
      version: row.version
    }));
  }

  public async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.logger.info('Policy engine database connection closed');
    }
  }
}

// Singleton instance
export const policyEngine = new AgentPolicyEngine();

// Export types and classes
export {
  AgentPolicyEngine,
  AgentRole,
  PolicyRule,
  KnowledgeBaseEntry,
  PolicyAssessment
};