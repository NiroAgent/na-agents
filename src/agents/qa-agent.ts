import { BaseAgent, AgentConfig, TaskPayload, TaskResult } from '../lib/BaseAgent';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

interface TestResult {
  testId: string;
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  coverage: number;
  duration: number;
  failures: Array<{
    test: string;
    error: string;
    stack?: string;
  }>;
}

class QAAgent extends BaseAgent {
  private testResults: Map<string, TestResult> = new Map();
  private testSuites: Map<string, any> = new Map();

  constructor() {
    const config: AgentConfig = {
      id: 'ai-qa-agent-1',
      type: 'qa',
      name: 'AI QA Agent',
      port: 5004,
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:4001',
      capabilities: [
        'unit_testing',
        'integration_testing',
        'e2e_testing',
        'performance_testing',
        'security_testing',
        'test_automation',
        'test_generation',
        'coverage_analysis',
        'regression_testing',
        'load_testing'
      ]
    };
    
    super(config);
    this.initializeTestSuites();
  }

  private initializeTestSuites(): void {
    this.testSuites.set('unit', {
      name: 'Unit Tests',
      framework: 'Jest',
      pattern: '**/*.test.ts'
    });
    
    this.testSuites.set('integration', {
      name: 'Integration Tests',
      framework: 'Jest',
      pattern: '**/*.integration.test.ts'
    });
    
    this.testSuites.set('e2e', {
      name: 'End-to-End Tests',
      framework: 'Playwright',
      pattern: '**/*.e2e.test.ts'
    });
  }

  protected async initialize(): Promise<void> {
    this.logger.info('QA Agent initialized with testing capabilities');
    this.logger.info(`Test frameworks: Jest, Playwright, K6`);
  }

  protected async cleanup(): Promise<void> {
    this.logger.info('QA Agent cleanup completed');
  }

  protected async handleTask(payload: TaskPayload): Promise<TaskResult> {
    this.logger.info(`Processing QA task: ${payload.task}`);
    this.status = 'busy';
    this.tasksInProgress++;

    try {
      const taskResult: TaskResult = {
        taskId: payload.taskId || uuidv4(),
        status: 'in_progress'
      };

      this.tasks.set(taskResult.taskId, taskResult);

      if (payload.task.toLowerCase().includes('test')) {
        const testResult = await this.runTests(payload);
        taskResult.result = testResult;
      } else if (payload.task.toLowerCase().includes('coverage')) {
        const coverageResult = await this.analyzeCoverage(payload);
        taskResult.result = coverageResult;
      } else if (payload.task.toLowerCase().includes('performance')) {
        const perfResult = await this.runPerformanceTests(payload);
        taskResult.result = perfResult;
      } else if (payload.task.toLowerCase().includes('security')) {
        const secResult = await this.runSecurityTests(payload);
        taskResult.result = secResult;
      } else {
        taskResult.result = {
          message: 'QA task processed',
          analysis: await this.analyzeQuality(payload)
        };
      }

      taskResult.status = 'completed';
      taskResult.completedAt = new Date().toISOString();
      this.tasksCompleted++;
      this.tasksInProgress--;
      this.status = 'idle';
      
      // Notify DevOps agent if tests pass
      if (taskResult.result.passed && payload.context.autoDeploy) {
        await this.notifyDevOpsAgent(taskResult.result);
      }
      
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
      case 'code_ready_for_testing':
        response = await this.testNewCode(message.payload);
        break;
      case 'run_test_suite':
        response = await this.runTestSuite(message.payload);
        break;
      case 'generate_tests':
        response = await this.generateTests(message.payload);
        break;
      case 'get_test_results':
        response = Array.from(this.testResults.values());
        break;
      default:
        response = { status: 'processed', message: `QA agent processed: ${message.type}` };
    }

    this.conversations.push({
      timestamp: new Date().toISOString(),
      type: 'sent',
      response
    });

    return response;
  }

  private async runTests(payload: TaskPayload): Promise<any> {
    const testId = uuidv4();
    const suite = payload.context.testSuite || 'unit';
    
    // Simulate test execution
    const testResult: TestResult = {
      testId,
      suite,
      passed: Math.floor(Math.random() * 50) + 50,
      failed: Math.floor(Math.random() * 5),
      skipped: Math.floor(Math.random() * 3),
      coverage: Math.floor(Math.random() * 20) + 70,
      duration: Math.floor(Math.random() * 30) + 10,
      failures: []
    };

    if (testResult.failed > 0) {
      testResult.failures = [
        {
          test: 'should handle edge cases',
          error: 'Expected value to be defined'
        }
      ];
    }

    this.testResults.set(testId, testResult);
    
    return {
      ...testResult,
      passed: testResult.failed === 0,
      summary: `${testResult.passed} passed, ${testResult.failed} failed, ${testResult.skipped} skipped`,
      coverageReport: `Coverage: ${testResult.coverage}%`
    };
  }

  private async analyzeCoverage(payload: TaskPayload): Promise<any> {
    return {
      overall: 85,
      statements: 87,
      branches: 78,
      functions: 92,
      lines: 85,
      uncoveredFiles: [
        'src/utils/helpers.ts',
        'src/services/legacy.ts'
      ],
      recommendations: [
        'Add tests for error handling paths',
        'Increase branch coverage in authentication module',
        'Add integration tests for API endpoints'
      ]
    };
  }

  private async runPerformanceTests(payload: TaskPayload): Promise<any> {
    return {
      status: 'completed',
      metrics: {
        responseTime: {
          p50: 45,
          p95: 120,
          p99: 250
        },
        throughput: '1000 req/s',
        errorRate: '0.1%',
        cpuUsage: '45%',
        memoryUsage: '60%'
      },
      recommendations: [
        'Optimize database queries',
        'Implement caching for frequently accessed data',
        'Consider horizontal scaling for peak loads'
      ]
    };
  }

  private async runSecurityTests(payload: TaskPayload): Promise<any> {
    return {
      status: 'completed',
      vulnerabilities: {
        critical: 0,
        high: 1,
        medium: 3,
        low: 5
      },
      issues: [
        {
          severity: 'high',
          type: 'SQL Injection',
          location: 'src/api/users.ts:45',
          recommendation: 'Use parameterized queries'
        },
        {
          severity: 'medium',
          type: 'Missing rate limiting',
          location: 'src/api/auth.ts',
          recommendation: 'Implement rate limiting middleware'
        }
      ],
      passed: false,
      report: 'Security scan completed with issues found'
    };
  }

  private async analyzeQuality(payload: TaskPayload): Promise<any> {
    return {
      codeQuality: {
        score: 'B',
        maintainability: 75,
        reliability: 85,
        security: 70,
        coverage: 80
      },
      issues: {
        bugs: 2,
        vulnerabilities: 1,
        codeSmells: 15,
        duplications: '3.2%'
      },
      recommendations: [
        'Refactor complex functions',
        'Add more unit tests',
        'Fix security vulnerabilities',
        'Reduce code duplication'
      ]
    };
  }

  private async testNewCode(codePayload: any): Promise<any> {
    const testPayload: TaskPayload = {
      taskId: uuidv4(),
      task: 'Run tests on new code',
      priority: 'high',
      context: {
        code: codePayload,
        testSuite: 'unit'
      }
    };
    
    return await this.runTests(testPayload);
  }

  private async runTestSuite(suiteConfig: any): Promise<any> {
    const suite = this.testSuites.get(suiteConfig.suite || 'unit');
    if (!suite) {
      return { error: 'Test suite not found' };
    }

    const payload: TaskPayload = {
      taskId: uuidv4(),
      task: `Run ${suite.name}`,
      priority: 'medium',
      context: suiteConfig
    };
    
    return await this.runTests(payload);
  }

  private async generateTests(codeData: any): Promise<any> {
    return {
      status: 'generated',
      tests: [
        {
          name: 'should create resource successfully',
          type: 'unit',
          code: 'expect(createResource(data)).toBeDefined();'
        },
        {
          name: 'should handle errors gracefully',
          type: 'unit',
          code: 'expect(() => createResource(null)).toThrow();'
        },
        {
          name: 'should integrate with database',
          type: 'integration',
          code: 'const result = await api.post("/resource", data);'
        }
      ],
      coverage: 'Estimated 75% coverage'
    };
  }

  private async notifyDevOpsAgent(testResult: any): Promise<void> {
    try {
      await axios.post('http://localhost:5003/agent/ai-devops-agent-1/message', {
        type: 'tests_passed',
        payload: {
          testResult,
          message: 'All tests passed, ready for deployment'
        }
      });
      this.logger.info('Notified DevOps agent that tests passed');
    } catch (error) {
      this.logger.warn('Could not notify DevOps agent:', error);
    }
  }
}

// Start the agent
const agent = new QAAgent();
agent.start().catch(error => {
  console.error('Failed to start QA Agent:', error);
  process.exit(1);
});