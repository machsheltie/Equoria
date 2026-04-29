import { AppError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';

const FORBIDDEN_KEY = '__proto__';
const FORBIDDEN_CONSTRUCTOR_KEY = 'constructor';
const FORBIDDEN_PROTOTYPE_KEY = 'prototype';

// Maximum allowed JSON nesting depth. Exceeding this throws AppError(400).
// 21R-SEC-3 (Equoria-expn): without a cap, recursive scanValue() and
// assertNoPollutingKeys() can be tricked into stack overflow by a deeply
// nested payload. Combined with a silent catch upstream, that bypasses
// both the duplicate-key detector and the prototype-pollution detector.
// Codebase audit (backend/__tests__/helpers/check-depth.mjs) confirmed the
// max bracket-nesting present in real backend code/tests is 14 — well
// below 32. The cap is configurable via REQUEST_BODY_MAX_DEPTH for
// emergencies but must not be relaxed without a doctrine review.
const MAX_DEPTH = Number.parseInt(process.env.REQUEST_BODY_MAX_DEPTH ?? '32', 10);

class JsonScanner {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }

  scan() {
    this.skipWhitespace();
    this.scanValue(0);
    this.skipWhitespace();
  }

  scanValue(depth) {
    if (depth > MAX_DEPTH) {
      throw new AppError('Invalid request body: nesting too deep', 400);
    }

    this.skipWhitespace();
    const char = this.source[this.index];

    if (char === '{') {
      this.scanObject(depth + 1);
      return;
    }

    if (char === '[') {
      this.scanArray(depth + 1);
      return;
    }

    if (char === '"') {
      this.scanString();
      return;
    }

    if (char === '-' || this.isDigit(char)) {
      this.scanNumber();
      return;
    }

    if (this.source.startsWith('true', this.index)) {
      this.index += 4;
      return;
    }

    if (this.source.startsWith('false', this.index)) {
      this.index += 5;
      return;
    }

    if (this.source.startsWith('null', this.index)) {
      this.index += 4;
    }
  }

  scanObject(depth) {
    const keys = new Set();
    this.index += 1;
    this.skipWhitespace();

    if (this.source[this.index] === '}') {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.skipWhitespace();
      const key = this.scanString();

      if (keys.has(key)) {
        throw new AppError(`Invalid request body: duplicate JSON key "${key}"`, 400);
      }
      keys.add(key);

      this.skipWhitespace();
      if (this.source[this.index] !== ':') {
        return;
      }

      this.index += 1;
      this.scanValue(depth);
      this.skipWhitespace();

      if (this.source[this.index] === ',') {
        this.index += 1;
        continue;
      }

      if (this.source[this.index] === '}') {
        this.index += 1;
        return;
      }

      return;
    }
  }

  scanArray(depth) {
    this.index += 1;
    this.skipWhitespace();

    if (this.source[this.index] === ']') {
      this.index += 1;
      return;
    }

    while (this.index < this.source.length) {
      this.scanValue(depth);
      this.skipWhitespace();

      if (this.source[this.index] === ',') {
        this.index += 1;
        continue;
      }

      if (this.source[this.index] === ']') {
        this.index += 1;
        return;
      }

      return;
    }
  }

  scanString() {
    this.index += 1;
    let value = '';

    while (this.index < this.source.length) {
      const char = this.source[this.index];

      if (char === '\\') {
        value += char;
        this.index += 1;
        if (this.index < this.source.length) {
          value += this.source[this.index];
        }
        this.index += 1;
        continue;
      }

      if (char === '"') {
        this.index += 1;
        return value;
      }

      value += char;
      this.index += 1;
    }

    return value;
  }

  scanNumber() {
    if (this.source[this.index] === '-') {
      this.index += 1;
    }

    while (this.isDigit(this.source[this.index])) {
      this.index += 1;
    }

    if (this.source[this.index] === '.') {
      this.index += 1;
      while (this.isDigit(this.source[this.index])) {
        this.index += 1;
      }
    }

    if (this.source[this.index] === 'e' || this.source[this.index] === 'E') {
      this.index += 1;
      if (this.source[this.index] === '+' || this.source[this.index] === '-') {
        this.index += 1;
      }
      while (this.isDigit(this.source[this.index])) {
        this.index += 1;
      }
    }
  }

  skipWhitespace() {
    while (/\s/.test(this.source[this.index] || '')) {
      this.index += 1;
    }
  }

  isDigit(char) {
    return char >= '0' && char <= '9';
  }
}

function assertNoPollutingKeys(value, path = 'body', depth = 0) {
  if (depth > MAX_DEPTH) {
    throw new AppError('Invalid request body: nesting too deep', 400);
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      assertNoPollutingKeys(entry, `${path}[${index}]`, depth + 1);
    });
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === FORBIDDEN_KEY) {
      throw new AppError(`Invalid request body: forbidden key "${key}"`, 400);
    }

    if (
      key === FORBIDDEN_CONSTRUCTOR_KEY &&
      child &&
      typeof child === 'object' &&
      Object.prototype.hasOwnProperty.call(child, FORBIDDEN_PROTOTYPE_KEY)
    ) {
      throw new AppError('Invalid request body: forbidden key path "constructor.prototype"', 400);
    }

    assertNoPollutingKeys(child, `${path}.${key}`, depth + 1);
  }
}

export function verifyJsonBody(req, _res, buffer) {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json') || buffer.length === 0) {
    return;
  }

  try {
    const raw = buffer.toString('utf8');
    new JsonScanner(raw).scan();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
  }
}

export function rejectPollutedRequestBody(req, _res, next) {
  try {
    assertNoPollutingKeys(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

export function requestBodySecurityErrorHandler(err, req, res, next) {
  if (typeof err?.message !== 'string' || !err.message.startsWith('Invalid request body:')) {
    return next(err);
  }

  logger.warn('[RequestBodySecurity] Rejected malicious request body', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    message: err.message,
  });

  return res.status(400).json({
    success: false,
    message: err.message,
  });
}
