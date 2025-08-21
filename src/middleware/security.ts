import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import rateLimit from 'express-rate-limit';

// Environment-based rate limiting
const createRateLimit = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Rate limiting configurations by environment
export const rateLimiters = {
  // General API rate limiting
  general: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    process.env.NODE_ENV === 'production' ? 100 : 1000, // 100 requests per 15 min in prod
    'Too many requests, please try again later'
  ),
  
  // Stricter rate limiting for sensitive endpoints
  strict: createRateLimit(
    5 * 60 * 1000, // 5 minutes
    process.env.NODE_ENV === 'production' ? 10 : 50, // 10 requests per 5 min in prod
    'Rate limit exceeded for sensitive endpoint'
  ),
  
  // Authentication attempts
  auth: createRateLimit(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per 15 minutes
    'Too many authentication attempts'
  )
};

// API Key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.NA_AGENTS_API_KEY;

  if (!expectedApiKey) {
    console.error('NA_AGENTS_API_KEY environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  // Use timing-safe comparison to prevent timing attacks
  const providedKeyBuffer = Buffer.from(apiKey, 'utf8');
  const expectedKeyBuffer = Buffer.from(expectedApiKey, 'utf8');

  if (providedKeyBuffer.length !== expectedKeyBuffer.length || 
      !timingSafeEqual(providedKeyBuffer, expectedKeyBuffer)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// GitHub webhook signature validation
export const validateGitHubWebhook = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const payload = JSON.stringify(req.body);
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error('GITHUB_WEBHOOK_SECRET environment variable not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (!signature) {
    return res.status(401).json({ error: 'Missing GitHub signature' });
  }

  const expectedSignature = 'sha256=' + createHash('sha256')
    .update(payload, 'utf8')
    .digest('hex');

  const providedSigBuffer = Buffer.from(signature, 'utf8');
  const expectedSigBuffer = Buffer.from(expectedSignature, 'utf8');

  if (providedSigBuffer.length !== expectedSigBuffer.length ||
      !timingSafeEqual(providedSigBuffer, expectedSigBuffer)) {
    return res.status(401).json({ error: 'Invalid GitHub signature' });
  }

  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Basic security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS (HTTP Strict Transport Security)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Allow inline scripts for agent responses
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self' https://api.github.com https://api.openai.com",
    "frame-ancestors 'none'"
  ].join('; '));

  next();
};

// Request sanitization middleware
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction) => {
  // Remove potentially dangerous characters from query parameters
  if (req.query) {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Remove script tags and other dangerous patterns
        req.query[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    }
  }

  // Validate request size
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = process.env.NODE_ENV === 'production' ? 1024 * 1024 : 10 * 1024 * 1024; // 1MB prod, 10MB dev

  if (contentLength > maxSize) {
    return res.status(413).json({ error: 'Request too large' });
  }

  next();
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress || 
                    req.headers['x-forwarded-for'] as string || 
                    req.headers['x-real-ip'] as string;

    if (!clientIP || !allowedIPs.includes(clientIP)) {
      return res.status(403).json({ error: 'Access denied from this IP' });
    }

    next();
  };
};

// CORS configuration
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      'https://dev.visualforge.ai',
      'https://stg.visualforge.ai', 
      'https://visualforge.ai',
      'https://dev.agents.visualforge.ai',
      'https://stg.agents.visualforge.ai',
      'https://agents.visualforge.ai'
    ];

    // Allow requests with no origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  maxAge: 86400 // 24 hours
};

// Audit logging middleware
export const auditLog = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      statusCode: res.statusCode,
      duration,
      contentLength: res.getHeader('content-length'),
      apiKey: req.headers['x-api-key'] ? '[REDACTED]' : undefined
    };

    // Log to CloudWatch or file based on environment
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logData));
    } else {
      console.log(`${logData.method} ${logData.url} - ${logData.statusCode} - ${duration}ms`);
    }
  });

  next();
};