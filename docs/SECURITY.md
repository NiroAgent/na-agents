# 🔒 NA-Agents Security Documentation

## Overview

Comprehensive security documentation for the NA-Agents multi-agent system, covering security architecture, authentication, authorization, network security, and compliance requirements.

## Security Architecture

### Multi-Layer Defense Strategy
```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet (Untrusted)                         │
└────────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Layer 1: AWS WAF Protection                      │
│ • Rate Limiting • SQL Injection Prevention • XSS Filtering      │
└────────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 2: TLS/HTTPS Encryption                     │
│ • TLS 1.3 • Certificate Validation • Perfect Forward Secrecy   │
└────────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 3: API Authentication                       │
│ • API Keys • Timing-Safe Validation • Request Signing        │
└────────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 4: Application Security                     │
│ • Input Validation • CORS Protection • Security Headers       │
└────────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Layer 5: Agent Security                        │
│ • Process Isolation • Resource Limits • Audit Logging        │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization

### API Key Authentication

#### Implementation
```typescript
// Timing-safe API key validation
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedKey = process.env.API_KEY;
  
  if (!apiKey || !expectedKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }
  
  try {
    const providedKeyBuffer = Buffer.from(apiKey, 'utf8');
    const expectedKeyBuffer = Buffer.from(expectedKey, 'utf8');
    
    // Timing-safe comparison to prevent timing attacks
    if (!timingSafeEqual(providedKeyBuffer, expectedKeyBuffer)) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};
```

#### Environment-Specific Keys
```yaml
Development:
  Key: dev-api-key-[random-32-chars]
  Rotation: Monthly
  Access: Development team only
  
Staging:
  Key: stg-api-key-[random-32-chars]
  Rotation: Bi-weekly
  Access: QA and DevOps teams
  
Production:
  Key: prd-api-key-[random-32-chars]
  Rotation: Weekly
  Access: DevOps team only
```

### GitHub Webhook Security

#### Signature Validation
```typescript
// GitHub webhook signature verification
export const validateGitHubSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  
  if (!signature || !secret) {
    return res.status(401).json({ error: 'Missing signature or secret' });
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  const expectedSignatureBuffer = Buffer.from(`sha256=${expectedSignature}`, 'utf8');
  const providedSignatureBuffer = Buffer.from(signature, 'utf8');
  
  if (!timingSafeEqual(expectedSignatureBuffer, providedSignatureBuffer)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};
```

## Network Security

### AWS WAF Configuration

#### Rate Limiting Rules
```yaml
# Environment-specific rate limits
Development:
  Rule: RateLimitDev
  Limit: 2000 requests per 15 minutes
  Action: Block
  
Staging:
  Rule: RateLimitStg
  Limit: 1500 requests per 15 minutes
  Action: Count and Block
  
Production:
  Rule: RateLimitPrd
  Limit: 1000 requests per 15 minutes
  Action: Block with alert
```

#### Security Rules
```yaml
SQL Injection Protection:
  Rule: AWSManagedRulesKnownBadInputsRuleSet
  Action: Block
  Priority: 1
  
XSS Protection:
  Rule: AWSManagedRulesCommonRuleSet
  Action: Block
  Priority: 2
  
Geographic Blocking:
  Rule: GeoBlocking
  Action: Block countries not in allowlist
  Priority: 3
  
Known Bad IPs:
  Rule: AWSManagedRulesAmazonIpReputationList
  Action: Block
  Priority: 4
```

### TLS/SSL Configuration

#### Certificate Management
```yaml
Certificate: *.visualforge.ai
Provider: AWS Certificate Manager
Validation: DNS
Renewal: Automatic
Protocols: TLS 1.2, TLS 1.3
Cipher Suites: Strong ciphers only
HSTS: max-age=31536000; includeSubDomains
```

#### Security Headers
```typescript
// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent XSS attacks
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' wss:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // HSTS (only over HTTPS)
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};
```

## Input Validation & Sanitization

### Request Validation
```typescript
// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Recursively sanitize object properties
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      return DOMPurify.sanitize(obj.trim());
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };
  
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};
```

### Schema Validation
```typescript
// Task payload validation
const taskSchema = Joi.object({
  taskId: Joi.string().alphanum().min(3).max(50).required(),
  task: Joi.string().min(1).max(5000).required(),
  priority: Joi.number().integer().min(1).max(10).default(5),
  agentType: Joi.string().valid('architect', 'developer', 'devops', 'qa', 'manager'),
  metadata: Joi.object().optional()
});

export const validateTaskPayload = (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = taskSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ 
      error: 'Invalid payload', 
      details: error.details.map(d => d.message)
    });
  }
  
  req.body = value;
  next();
};
```

## Data Protection

### Encryption at Rest
```yaml
DynamoDB:
  Encryption: Customer Managed Keys (CMK)
  Key Rotation: Annual
  Access: Restricted to application roles
  
S3 Storage:
  Encryption: AES-256 / KMS
  Versioning: Enabled
  Access Logging: Enabled
  
Secrets Manager:
  Encryption: AWS KMS
  Automatic Rotation: Enabled
  Cross-region Replication: Enabled
```

### Encryption in Transit
```yaml
HTTPS/TLS:
  Version: TLS 1.3 preferred, TLS 1.2 minimum
  Certificate: Wildcard (*.visualforge.ai)
  Perfect Forward Secrecy: Enabled
  
WebSocket Secure (WSS):
  Protocol: WSS over TLS 1.3
  Certificate: Same as HTTPS
  Connection Encryption: End-to-end
  
Inter-Service Communication:
  Protocol: HTTPS with mutual TLS
  Certificate Validation: Strict
  Service Mesh: Optional Istio integration
```

### Secrets Management
```typescript
// Secure secrets retrieval
export class SecretsManager {
  private static cache = new Map<string, { value: string; expiry: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  static async getSecret(secretName: string): Promise<string> {
    // Check cache first
    const cached = this.cache.get(secretName);
    if (cached && cached.expiry > Date.now()) {
      return cached.value;
    }
    
    try {
      const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await client.send(command);
      
      if (!response.SecretString) {
        throw new Error('Secret value not found');
      }
      
      // Cache the secret
      this.cache.set(secretName, {
        value: response.SecretString,
        expiry: Date.now() + this.CACHE_TTL
      });
      
      return response.SecretString;
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      throw new Error('Secret retrieval failed');
    }
  }
  
  static clearCache(): void {
    this.cache.clear();
  }
}
```

## Audit Logging

### Security Event Logging
```typescript
// Security audit logger
export class SecurityAuditLogger {
  private static readonly logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.CloudWatchLogs({
        logGroupName: '/aws/lambda/na-agents-security',
        logStreamName: `security-${new Date().toISOString().split('T')[0]}`,
        awsRegion: process.env.AWS_REGION
      })
    ]
  });
  
  static logSecurityEvent(event: {
    type: 'authentication' | 'authorization' | 'access' | 'error';
    action: string;
    userId?: string;
    ip: string;
    userAgent: string;
    success: boolean;
    details?: any;
  }): void {
    this.logger.info('Security Event', {
      ...event,
      timestamp: new Date().toISOString(),
      traceId: crypto.randomUUID()
    });
  }
  
  static logApiAccess(req: Request, res: Response, responseTime: number): void {
    this.logSecurityEvent({
      type: 'access',
      action: `${req.method} ${req.path}`,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      success: res.statusCode < 400,
      details: {
        statusCode: res.statusCode,
        responseTime,
        contentLength: res.get('Content-Length')
      }
    });
  }
}
```

### Compliance Logging
```yaml
Log Retention:
  Security Events: 7 years
  Access Logs: 1 year
  Application Logs: 90 days
  Debug Logs: 30 days
  
Log Integrity:
  Tamper Protection: Enabled
  Digital Signatures: CloudTrail integration
  Backup: Cross-region replication
  
Compliance Standards:
  SOC 2 Type II: Supported
  ISO 27001: Supported
  GDPR: Data protection compliant
  CCPA: Privacy compliant
```

## Vulnerability Management

### Automated Security Scanning
```yaml
Dependency Scanning:
  Tool: npm audit, Snyk
  Frequency: On every build
  Action: Block deployment on high/critical
  
Static Code Analysis:
  Tool: SonarCloud, CodeQL
  Frequency: On every PR
  Coverage: Security hotspots, vulnerabilities
  
Container Scanning:
  Tool: Docker Scout, Trivy
  Frequency: On image build
  Base Images: Minimal, regularly updated
  
Infrastructure Scanning:
  Tool: AWS Config, Prowler
  Frequency: Daily
  Scope: IAM, Network, Storage, Compute
```

### Penetration Testing
```yaml
Schedule:
  External Testing: Quarterly
  Internal Testing: Monthly
  Automated Testing: Daily
  
Scope:
  Web Application: Full OWASP Top 10
  API Endpoints: Authentication, authorization
  Infrastructure: Network, systems, cloud
  
Remediation:
  Critical: 24 hours
  High: 7 days
  Medium: 30 days
  Low: 90 days
```

## Incident Response

### Security Incident Response Plan
```yaml
Detection:
  Automated Alerts: CloudWatch, WAF
  Manual Reports: Security team, developers
  Third-party: Bug bounty, researchers
  
Response Team:
  Lead: Security Engineer
  Technical: DevOps Engineer
  Communication: Product Manager
  Legal: Compliance Officer
  
Response Timeline:
  Detection to Assessment: 15 minutes
  Assessment to Containment: 1 hour
  Containment to Resolution: 4 hours
  Resolution to Post-mortem: 24 hours
```

### Incident Classification
```yaml
Critical (P0):
  - Data breach or unauthorized access
  - Service completely unavailable
  - Active attack in progress
  Response: Immediate (15 minutes)
  
High (P1):
  - Significant security vulnerability
  - Service partially unavailable
  - Potential data exposure
  Response: 1 hour
  
Medium (P2):
  - Minor security issues
  - Performance degradation
  - Configuration issues
  Response: 4 hours
  
Low (P3):
  - Security recommendations
  - Documentation issues
  - Minor bugs
  Response: 24 hours
```

## Security Testing

### Automated Security Tests
```bash
# Security test suite
npm run test:security

# Specific security test categories
npm run test:security:auth          # Authentication tests
npm run test:security:input         # Input validation tests
npm run test:security:access        # Access control tests
npm run test:security:crypto        # Cryptography tests
```

### Security Test Implementation
```typescript
// Authentication security tests
describe('API Authentication Security', () => {
  test('should reject requests without API key', async () => {
    const response = await request(app)
      .get('/api/agents')
      .expect(401);
      
    expect(response.body.error).toBe('Missing API key');
  });
  
  test('should reject requests with invalid API key', async () => {
    const response = await request(app)
      .get('/api/agents')
      .set('X-API-Key', 'invalid-key')
      .expect(401);
      
    expect(response.body.error).toBe('Invalid API key');
  });
  
  test('should prevent timing attacks on API key validation', async () => {
    const startTime = Date.now();
    
    // Test with various invalid keys of different lengths
    const invalidKeys = ['a', 'ab', 'abc', 'a'.repeat(100)];
    const times: number[] = [];
    
    for (const key of invalidKeys) {
      const testStart = Date.now();
      await request(app)
        .get('/api/agents')
        .set('X-API-Key', key)
        .expect(401);
      times.push(Date.now() - testStart);
    }
    
    // All validation times should be similar (within 10ms)
    const avgTime = times.reduce((a, b) => a + b) / times.length;
    times.forEach(time => {
      expect(Math.abs(time - avgTime)).toBeLessThan(10);
    });
  });
});
```

## Security Configuration

### Environment Variables
```bash
# Required security environment variables
API_KEY=your-secret-api-key-here
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key

# AWS Security
AWS_REGION=us-east-1
SECRETS_MANAGER_ARN=arn:aws:secretsmanager:region:account:secret:name

# Security Features
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOGGING=true
ENABLE_SECURITY_HEADERS=true
ENABLE_INPUT_VALIDATION=true
```

### Production Security Checklist
- [ ] All API keys rotated and stored in AWS Secrets Manager
- [ ] WAF rules configured and tested
- [ ] TLS 1.3 enforced with strong cipher suites
- [ ] Security headers configured correctly
- [ ] Input validation and sanitization enabled
- [ ] Rate limiting configured per environment
- [ ] Audit logging enabled and monitored
- [ ] Vulnerability scanning automated
- [ ] Incident response plan tested
- [ ] Security tests passing in CI/CD
- [ ] Penetration testing completed
- [ ] Security documentation up to date

---

*Last Updated: August 21, 2025*  
*Security Review: Quarterly*  
*Next Security Audit: November 21, 2025*