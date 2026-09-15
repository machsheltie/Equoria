/**
 * Sentry boot with a DSN (Equoria-9al2s).
 *
 * Every other Sentry test runs without SENTRY_DSN and only covers the
 * early-return branches, which is how initializeSentry()/attachSentryErrorHandler()
 * could call Handlers.requestHandler/tracingHandler/errorHandler — absent from
 * the installed @sentry/node 10.x — and nobody noticed. This test drives the
 * real init path with a DSN pointing at a local HTTP receiver for Sentry's
 * envelope endpoint (the third-party boundary), so it proves:
 *   1. initializeSentry() loads the SDK and boots without throwing;
 *   2. attachSentryErrorHandler() installs the v8+ Express error handler and a
 *      thrown route error reaches Sentry as an envelope containing the message;
 *   3. captureSecurityException() delivers an envelope after init.
 * Nothing is mocked inside Equoria; only the outbound Sentry endpoint is local.
 */
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { createServer } from 'node:http';
import { once } from 'node:events';
import express from 'express';
import request from 'supertest';

const received = [];
let server;
let dsn;
let savedDsn;
let savedNodeEnv;
let sentry;

async function waitForEnvelope(predicate, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hit = received.find(predicate);
    if (hit) {
      return hit;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`no matching Sentry envelope within ${timeoutMs}ms (received ${received.length})`);
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received.push({ url: req.url, body: Buffer.concat(chunks).toString('utf8') });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  dsn = `http://publickey@127.0.0.1:${port}/1`;

  savedDsn = process.env.SENTRY_DSN;
  savedNodeEnv = process.env.NODE_ENV;
  process.env.SENTRY_DSN = dsn;
  // beforeSend drops every event when NODE_ENV === 'test'; this test is about
  // the transport, so init under a distinct environment name.
  process.env.NODE_ENV = 'sentry-dsn-verify';
  sentry = await import('../config/sentry.mjs');
}, 30000);

afterAll(async () => {
  if (savedDsn === undefined) {
    delete process.env.SENTRY_DSN;
  } else {
    process.env.SENTRY_DSN = savedDsn;
  }
  process.env.NODE_ENV = savedNodeEnv;
  await new Promise(resolve => server.close(resolve));
});

describe('Sentry boot with a DSN (Equoria-9al2s)', () => {
  test('initializeSentry loads the SDK and boots without throwing', async () => {
    await expect(sentry.initializeSentry(express())).resolves.toBeUndefined();
  }, 30000);

  test('a thrown route error reaches the DSN through the v8+ Express error handler', async () => {
    const app = express();
    app.get('/boom', () => {
      const error = new Error('sentry-dsn-verify route failure');
      error.status = 500;
      throw error;
    });
    sentry.attachSentryErrorHandler(app);
    // Terminal handler so supertest gets a response after Sentry has seen the error.

    app.use((error, req, res, _next) => {
      res.status(error.status || 500).json({ ok: false });
    });

    const res = await request(app).get('/boom');
    expect(res.status).toBe(500);

    const envelope = await waitForEnvelope(
      e => /\/api\/1\/envelope\/?/.test(e.url) && e.body.includes('sentry-dsn-verify route failure'),
    );
    expect(envelope.body).toContain('"type":"event"');
  }, 20000);

  test('captureSecurityException delivers an envelope after init', async () => {
    sentry.captureSecurityException(new Error('sentry-dsn-verify security capture'), {
      probe: 'Equoria-9al2s',
    });
    const envelope = await waitForEnvelope(e => e.body.includes('sentry-dsn-verify security capture'));
    expect(envelope.url).toMatch(/\/api\/1\/envelope\/?/);
  }, 20000);
});
