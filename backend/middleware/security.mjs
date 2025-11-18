import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger.mjs';

/**
 * Security Middleware Configuration
 * Implements comprehensive security measures for the API
 */

// CORS configuration
export const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];

    // Add production origins from environment
    if (process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
    }

    // Allow requests with no origin IF they have a valid API key (CWE-942)
    // NOTE: This is temporary backward compatibility - will be removed in Phase 3
    if (!origin) {
      logger.warn('[CORS] Request with no origin detected - API key validation required');
      return callback(null, true); // Still allowed for backward compatibility
    }

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
};

// Rate limiting configuration
export const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100) => {
  return rateLimit({
    windowMs, // 15 minutes default
    max, // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
      });

      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
  });
};

// Helmet configuration for security headers
export const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
};

// API-specific rate limiters
export const apiLimiter = createRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
export const strictLimiter = createRateLimiter(15 * 60 * 1000, 20); // 20 requests per 15 minutes
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5); // 5 requests per 15 minutes

/**
 * API Key validation middleware (CWE-942: Permissive Cross-domain Policy)
 * Validates X-API-Key header for requests with no origin
 */
export const validateApiKey = (req, res, next) => {
  // Only validate API key for requests with no origin
  const origin = req.get('origin');

  if (!origin) {
    const apiKey = req.get('X-API-Key');
    const validApiKey = process.env.API_KEY;

    // If API_KEY is not configured, log warning but allow (backward compatibility)
    if (!validApiKey) {
      logger.warn('[API Key] API_KEY not configured - requests with no origin are allowed (INSECURE)');
      return next();
    }

    // If API key is missing or invalid, reject
    if (!apiKey || apiKey !== validApiKey) {
      logger.warn('[API Key] Invalid or missing API key', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl,
        hasApiKey: !!apiKey,
      });

      return res.status(403).json({
        success: false,
        error: 'API key required for requests without origin header',
      });
    }

    logger.debug('[API Key] Valid API key provided');
  }

  next();
};

/**
 * HTTPS Enforcement Middleware (CWE-319: Cleartext Transmission)
 * Redirects HTTP requests to HTTPS in production
 */
export const enforceHttps = (req, res, next) => {
  // Only enforce HTTPS in production
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  // Check if request is already HTTPS
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    req.headers['x-forwarded-ssl'] === 'on';

  if (!isHttps) {
    logger.warn('[HTTPS] Insecure HTTP request detected, redirecting to HTTPS', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    // Redirect to HTTPS
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }

  next();
};

/**
 * Strict Transport Security Middleware (CWE-319)
 * Adds HSTS header to enforce HTTPS for future requests
 */
export const addSecurityHeaders = (req, res, next) => {
  // HSTS: Force HTTPS for 1 year (already in helmet, but adding explicitly)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy (don't leak URLs)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy (disable sensitive features)
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
};

// Security middleware factory
export const createSecurityMiddleware = () => {
  return [
    enforceHttps,           // Redirect HTTP to HTTPS (production only)
    addSecurityHeaders,     // Add security headers
    helmet(helmetConfig),   // Helmet security headers
    cors(corsOptions),      // CORS validation
    validateApiKey,         // API key validation
    apiLimiter,             // Rate limiting
  ];
};
