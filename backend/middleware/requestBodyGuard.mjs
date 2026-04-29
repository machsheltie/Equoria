/**
 * requestBodyGuard.mjs — Body-layer JSON safety middleware
 *
 * Beta-readiness fix Equoria-ocn9: closes two parameter-pollution defenses
 * the audit flagged as missing.
 *
 *   1. secureJsonBodyParser — replaces express.json() and rejects JSON
 *      payloads that contain DUPLICATE KEYS in the same object. Express's
 *      built-in parser silently keeps the last value, which lets an attacker
 *      smuggle a second value past validators that only inspect the first.
 *      Detection runs on the raw body buffer with a small streaming JSON
 *      tokenizer (no extra dependency).
 *
 *   2. prototypePollutionGuard — recursively walks the parsed body and
 *      rejects any payload that contains an own property named "__proto__",
 *      "constructor", or "prototype" at any depth. Returning 400 (not
 *      silently stripping) is the explicit behavior the readiness audit
 *      requires: "no admitted unimplemented defenses."
 *
 * Both functions return Express middleware. Both respond with the standard
 * Equoria error envelope `{ success: false, message }` and HTTP 400.
 */

import express from 'express';
import logger from '../utils/logger.mjs';

const POLLUTION_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Maximum object/array nesting depth `findPollutionKey` will traverse before
 * it bails out and rejects the body with HTTP 400. JSON.parse in V8 can
 * accept ~100k levels of nesting; without a depth cap, the recursive walk
 * would exhaust the call stack and crash the worker — converting the
 * defense into a DoS vector. 200 is well above any realistic legitimate
 * payload (Equoria's deepest documented body is single-digit nesting).
 */
const MAX_BODY_DEPTH = 200;

/**
 * Decodes a JSON-string substring into the actual property name it
 * represents. The duplicate-key tokenizer captures the RAW characters
 * between the quote marks, but JSON allows the same logical key to be
 * written multiple ways (`name`, `\u006eame`, etc.). Without normalising
 * before deduplication, an attacker can write `{"name":"a","\u006eame":"b"}`
 * — two different raw substrings, one logical key — and slip the second
 * value past validators that only inspect the first.
 *
 * Wrapping the substring in quotes and running JSON.parse gives V8 the
 * standard JSON string-decoding logic for free, including surrogate pairs
 * and all valid escape sequences.
 *
 * Returns the decoded key on success, or the raw substring as a fallback
 * if decoding fails — JSON.parse will throw on the actual body parse a
 * moment later, so we never end up trusting a malformed key.
 */
function decodeJsonKey(rawKey) {
  try {
    return JSON.parse(`"${rawKey}"`);
  } catch {
    return rawKey;
  }
}

/**
 * Detects duplicate top-level-or-nested object keys in a raw JSON string.
 *
 * Walks the input character-by-character maintaining a stack of "object
 * scopes". Each scope holds the set of keys already seen at that depth.
 * Throws when a key is seen twice in the same scope.
 *
 * Implementation notes:
 *   - Skips array scopes (arrays don't have duplicate-key semantics).
 *   - Handles escaped quotes inside string literals correctly.
 *   - Operates on the trimmed, UTF-8-decoded buffer Express hands to verify().
 *   - Linear in the input length; no recursion.
 *
 * @param {string} raw - The raw JSON text from the request body.
 * @throws {Error} with .statusCode=400 when a duplicate key is detected.
 */
export function detectDuplicateJsonKeys(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return;
  }

  const scopes = []; // each entry: { type: 'object'|'array', keys: Set }
  let i = 0;
  const len = raw.length;

  while (i < len) {
    const ch = raw[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    if (ch === '{') {
      scopes.push({ type: 'object', keys: new Set(), expectingKey: true });
      i++;
      continue;
    }

    if (ch === '[') {
      scopes.push({ type: 'array' });
      i++;
      continue;
    }

    if (ch === '}' || ch === ']') {
      scopes.pop();
      i++;
      continue;
    }

    if (ch === ',') {
      const top = scopes[scopes.length - 1];
      if (top && top.type === 'object') {
        top.expectingKey = true;
      }
      i++;
      continue;
    }

    if (ch === ':') {
      const top = scopes[scopes.length - 1];
      if (top && top.type === 'object') {
        top.expectingKey = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      // Read the string literal; remember start so we can extract it if it
      // turns out to be a key.
      const start = i + 1;
      i++;
      let foundClose = false;
      while (i < len) {
        if (raw[i] === '\\') {
          // Skip the backslash and the next char. If the body ends mid-
          // escape (i + 1 >= len), the JSON is malformed: stop walking and
          // throw so a future refactor that moves this scan post-parse
          // can't silently admit a duplicate-key bypass.
          if (i + 1 >= len) {
            const err = new Error('Malformed JSON: trailing escape in string literal');
            err.statusCode = 400;
            err.code = 'MALFORMED_JSON_BODY';
            throw err;
          }
          i += 2; // skip escape sequence (\" \\ \/ \b \f \n \r \t \uXXXX)
          continue;
        }
        if (raw[i] === '"') {
          foundClose = true;
          break;
        }
        i++;
      }
      // String literal never terminated. As above, refuse to scan further
      // rather than silently produce a meaningless rawKey.
      if (!foundClose) {
        const err = new Error('Malformed JSON: unterminated string literal');
        err.statusCode = 400;
        err.code = 'MALFORMED_JSON_BODY';
        throw err;
      }
      const rawKey = raw.slice(start, i);
      i++; // consume closing quote

      const top = scopes[scopes.length - 1];
      if (top && top.type === 'object' && top.expectingKey === true) {
        // Equoria-ocn9 review fix: decode JSON escapes BEFORE adding to the
        // dedupe set. Without this, `{"name":"a","\u006eame":"b"}` is seen
        // as two distinct keys but JSON.parse later collapses both to
        // property `name` (last-wins), defeating the duplicate-key defense.
        const key = decodeJsonKey(rawKey);
        if (top.keys.has(key)) {
          const err = new Error(`Duplicate key "${key}" in JSON body`);
          err.statusCode = 400;
          err.code = 'DUPLICATE_JSON_KEY';
          throw err;
        }
        top.keys.add(key);
      }
      continue;
    }

    // Any other character (number, true/false/null, etc.) — advance.
    i++;
  }
}

/**
 * Returns Express middleware that parses JSON bodies AND rejects duplicate
 * keys at parse time. Drop-in replacement for `express.json()`.
 *
 * Why a verify hook? Because once express.json() finishes parsing, the
 * duplicate is already gone (last-value-wins). We must inspect the raw
 * buffer before parse completes.
 *
 * @param {object} [opts] - Forwarded to express.json (e.g. { limit: '10mb' }).
 */
export function secureJsonBodyParser(opts = {}) {
  return express.json({
    ...opts,
    verify: (req, _res, buf) => {
      if (!buf || buf.length === 0) {
        return;
      }
      const raw = buf.toString('utf8');
      // Only inspect bodies that actually look like JSON objects/arrays.
      const trimmed = raw.trimStart();
      if (trimmed[0] !== '{' && trimmed[0] !== '[') {
        return;
      }
      try {
        detectDuplicateJsonKeys(raw);
      } catch (err) {
        if (err && err.code === 'DUPLICATE_JSON_KEY') {
          logger.warn(
            `[requestBodyGuard] Rejected duplicate JSON key on ${req.method} ${req.path}: ${err.message}`,
          );
          throw err;
        }
        throw err;
      }
    },
  });
}

/**
 * Iteratively walks `value` looking for own properties named __proto__,
 * constructor, or prototype. Returns the offending key path on first hit,
 * or null when the structure is clean.
 *
 * Equoria-ocn9 review fix: previously recursive. A 10 MB deeply-nested body
 * that V8 accepts at parse time (JSON.parse supports ~100k depth) would
 * blow the call stack here with `RangeError: Maximum call stack size
 * exceeded`, turning the middleware into a DoS vector. Now iterative with
 * an explicit MAX_BODY_DEPTH cap; throws `BODY_DEPTH_EXCEEDED` when the
 * cap is hit so the guard can respond with a clean 400.
 *
 * @param {*} root
 * @throws {Error} with `.code === 'BODY_DEPTH_EXCEEDED'` when nesting
 *   exceeds MAX_BODY_DEPTH.
 */
export function findPollutionKey(root) {
  if (!root || typeof root !== 'object') {
    return null;
  }

  // DFS with an explicit stack. Each frame: { value, path, depth }.
  const stack = [{ value: root, path: [], depth: 0 }];
  while (stack.length > 0) {
    const { value, path, depth } = stack.pop();
    if (depth > MAX_BODY_DEPTH) {
      const err = new Error(`Request body nesting exceeds ${MAX_BODY_DEPTH} levels`);
      err.code = 'BODY_DEPTH_EXCEEDED';
      throw err;
    }

    // Object.getOwnPropertyNames catches __proto__ even though Object.keys()
    // hides it on plain objects after a property assignment. JSON.parse
    // attaches `__proto__` as an own data property (not a prototype change)
    // so this enumeration sees it.
    const ownKeys = Object.getOwnPropertyNames(value);
    for (const key of ownKeys) {
      if (POLLUTION_KEYS.has(key)) {
        return [...path, key].join('.');
      }
      const next = value[key];
      if (next && typeof next === 'object') {
        stack.push({ value: next, path: [...path, key], depth: depth + 1 });
      }
    }
  }

  return null;
}

/**
 * Express middleware: rejects requests whose parsed body contains any
 * prototype-pollution key. Apply IMMEDIATELY after the JSON body parser.
 */
export function prototypePollutionGuard() {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      let offendingPath;
      try {
        offendingPath = findPollutionKey(req.body);
      } catch (err) {
        if (err && err.code === 'BODY_DEPTH_EXCEEDED') {
          logger.warn(
            `[requestBodyGuard] Rejected over-deep request body on ${req.method} ${req.path}: ${err.message}`,
          );
          return res.status(400).json({
            success: false,
            message: 'Request body nesting too deep',
          });
        }
        return next(err);
      }
      if (offendingPath) {
        logger.warn(
          `[requestBodyGuard] Rejected prototype-pollution attempt on ${req.method} ${req.path}: key=${offendingPath}`,
        );
        return res.status(400).json({
          success: false,
          message: `Request body contains a forbidden key (${offendingPath})`,
        });
      }
    }
    next();
  };
}

/**
 * Express error handler that translates body-parser failures (including the
 * DUPLICATE_JSON_KEY error thrown by `secureJsonBodyParser`) into the
 * standard `{ success: false, message }` envelope with HTTP 400.
 *
 * Mount AFTER all routes if you want consistent error shape; or rely on the
 * global error handler. We export this so app.mjs can wire it explicitly.
 */
export function jsonBodyErrorHandler() {
  return (err, _req, res, next) => {
    if (!err) {
      return next();
    }

    if (err.code === 'DUPLICATE_JSON_KEY') {
      return res.status(400).json({
        success: false,
        message: err.message || 'Duplicate key in JSON body',
      });
    }

    // express.json() throws SyntaxError for malformed JSON. Keep the response
    // shape consistent with the rest of the API.
    if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({
        success: false,
        message: 'Malformed JSON in request body',
      });
    }

    return next(err);
  };
}
