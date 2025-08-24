import { exec } from 'child_process';
import { promisify } from 'util';
import PQueue from 'p-queue';
import * as fs from 'fs/promises';
import * as path from 'path';
import winston from 'winston';

const execAsync = promisify(exec);

interface CopilotRequest {
  prompt: string;
  language?: string;
  context?: string;
  maxTokens?: number;
}

interface CopilotResponse {
  code: string;
  explanation?: string;
  confidence?: number;
  timestamp: string;
}

export class CopilotService {
  private queue: PQueue;
  private logger: winston.Logger;
  private requestCount = 0;
  private lastRequestTime = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 20; // Conservative rate limit
  private readonly TEMP_DIR = path.join(process.cwd(), 'temp');

  constructor() {
    // Rate limiting queue - 1 request at a time with minimum 3 second interval
    this.queue = new PQueue({
      concurrency: 1,
      interval: 3000,
      intervalCap: 1
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/copilot-service.log' })
      ]
    });

    this.ensureTempDirectory();
  }

  private async ensureTempDirectory() {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create temp directory:', error);
    }
  }

  /**
   * Generate code using GitHub Copilot CLI
   */
  async generateCode(request: CopilotRequest): Promise<CopilotResponse> {
    const result = await this.queue.add<CopilotResponse>(async () => {
      try {
        this.enforceRateLimit();
        
        const { prompt, language = 'typescript', context } = request;
        
        // Prepare the prompt with context
        let fullPrompt = prompt;
        if (context) {
          fullPrompt = `Context: ${context}\n\nTask: ${prompt}`;
        }

        // Use GitHub Copilot CLI to suggest code
        const command = this.buildCopilotCommand(fullPrompt, language);
        
        this.logger.info('Executing Copilot request', {
          language,
          promptLength: fullPrompt.length,
          requestCount: ++this.requestCount
        });

        const { stdout, stderr } = await execAsync(command, {
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
          timeout: 30000 // 30 second timeout
        });

        if (stderr && !stderr.includes('Welcome to GitHub Copilot')) {
          this.logger.warn('Copilot stderr output:', stderr);
        }

        const code = this.extractCodeFromResponse(stdout);
        
        return {
          code,
          explanation: this.extractExplanation(stdout),
          confidence: this.calculateConfidence(code),
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        this.logger.error('Copilot generation failed:', error);
        throw new Error(`Copilot generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    return result!;
  }

  /**
   * Explain existing code using Copilot
   */
  async explainCode(code: string, language: string = 'typescript'): Promise<string> {
    const result = await this.queue.add<string>(async () => {
      try {
        this.enforceRateLimit();

        // Save code to temp file for analysis
        const tempFile = path.join(this.TEMP_DIR, `code_${Date.now()}.${this.getFileExtension(language)}`);
        await fs.writeFile(tempFile, code);

        const command = `gh copilot explain "${tempFile}"`;
        
        const { stdout } = await execAsync(command, {
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        });

        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});

        return stdout;

      } catch (error) {
        this.logger.error('Code explanation failed:', error);
        throw error;
      }
    });
    return result!;
  }

  /**
   * Suggest improvements for code
   */
  async suggestImprovements(code: string, language: string = 'typescript'): Promise<string> {
    const result = await this.queue.add<string>(async () => {
      try {
        this.enforceRateLimit();

        const prompt = `Review this ${language} code and suggest improvements for performance, readability, and best practices:\n\n${code}`;
        
        const command = `echo "${this.escapeForShell(prompt)}" | gh copilot suggest -t shell`;
        
        const { stdout } = await execAsync(command, {
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        });

        return this.extractCodeFromResponse(stdout);

      } catch (error) {
        this.logger.error('Code improvement suggestion failed:', error);
        throw error;
      }
    });
    return result!;
  }

  /**
   * Generate unit tests for code
   */
  async generateTests(code: string, language: string = 'typescript', framework: string = 'jest'): Promise<string> {
    const result = await this.queue.add<string>(async () => {
      try {
        this.enforceRateLimit();

        const prompt = `Generate comprehensive ${framework} unit tests for this ${language} code:\n\n${code}`;
        
        const command = `echo "${this.escapeForShell(prompt)}" | gh copilot suggest -t shell`;
        
        const { stdout } = await execAsync(command, {
          maxBuffer: 1024 * 1024 * 10,
          timeout: 30000
        });

        return this.extractCodeFromResponse(stdout);

      } catch (error) {
        this.logger.error('Test generation failed:', error);
        throw error;
      }
    });
    return result!;
  }

  /**
   * Build the Copilot CLI command based on the request
   */
  private buildCopilotCommand(prompt: string, language: string): string {
    // Escape special characters for shell
    const escapedPrompt = this.escapeForShell(prompt);
    
    // Use the suggest command with appropriate target
    const target = this.getTargetForLanguage(language);
    
    return `echo "${escapedPrompt}" | gh copilot suggest -t ${target}`;
  }

  /**
   * Map programming language to Copilot target
   */
  private getTargetForLanguage(language: string): string {
    const languageMap: Record<string, string> = {
      'typescript': 'shell',
      'javascript': 'shell',
      'python': 'shell',
      'java': 'shell',
      'go': 'shell',
      'rust': 'shell',
      'bash': 'shell',
      'sql': 'shell'
    };
    
    return languageMap[language.toLowerCase()] || 'shell';
  }

  /**
   * Get file extension for language
   */
  private getFileExtension(language: string): string {
    const extensionMap: Record<string, string> = {
      'typescript': 'ts',
      'javascript': 'js',
      'python': 'py',
      'java': 'java',
      'go': 'go',
      'rust': 'rs',
      'bash': 'sh',
      'sql': 'sql'
    };
    
    return extensionMap[language.toLowerCase()] || 'txt';
  }

  /**
   * Extract code from Copilot response
   */
  private extractCodeFromResponse(response: string): string {
    // Remove ANSI escape codes
    const cleanResponse = response.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Try to extract code blocks
    const codeBlockMatch = cleanResponse.match(/```[\s\S]*?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    // Try to find code after common prefixes
    const prefixes = [
      '## Suggestion:',
      '## Code:',
      'Here\'s',
      'Try this:',
      'You can use:'
    ];
    
    for (const prefix of prefixes) {
      const index = cleanResponse.indexOf(prefix);
      if (index !== -1) {
        const codeStart = cleanResponse.substring(index + prefix.length).trim();
        return codeStart.split('\n\n')[0].trim();
      }
    }
    
    // Return cleaned response if no specific code block found
    return cleanResponse.trim();
  }

  /**
   * Extract explanation from response
   */
  private extractExplanation(response: string): string {
    const cleanResponse = response.replace(/\x1b\[[0-9;]*m/g, '');
    
    // Look for explanation patterns
    const explanationMatch = cleanResponse.match(/## Explanation:([\s\S]*?)(?:##|$)/);
    if (explanationMatch) {
      return explanationMatch[1].trim();
    }
    
    // Look for description before code
    const codeIndex = cleanResponse.indexOf('```');
    if (codeIndex > 0) {
      return cleanResponse.substring(0, codeIndex).trim();
    }
    
    return '';
  }

  /**
   * Calculate confidence score based on response quality
   */
  private calculateConfidence(code: string): number {
    if (!code || code.length < 10) return 0.1;
    
    // Basic heuristics for confidence
    let confidence = 0.5;
    
    // Check for syntax patterns
    if (code.includes('function') || code.includes('class') || code.includes('const')) {
      confidence += 0.2;
    }
    
    // Check for proper structure
    if (code.includes('{') && code.includes('}')) {
      confidence += 0.1;
    }
    
    // Check for comments
    if (code.includes('//') || code.includes('/*')) {
      confidence += 0.1;
    }
    
    // Length-based confidence
    if (code.length > 100) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Escape string for shell execution
   */
  private escapeForShell(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\n/g, '\\n');
  }

  /**
   * Enforce rate limiting
   */
  private enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Reset counter if it's been more than a minute
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
    }
    
    // Check if we're exceeding rate limit
    if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
      throw new Error('Rate limit exceeded. Please wait before making more requests.');
    }
    
    this.lastRequestTime = now;
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      requestCount: this.requestCount,
      queueSize: this.queue.size,
      queuePending: this.queue.pending,
      lastRequestTime: new Date(this.lastRequestTime).toISOString()
    };
  }
}

// Singleton instance
export const copilotService = new CopilotService();