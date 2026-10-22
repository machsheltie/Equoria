/**
 * Global error handler — internal 500 messages never reach the client
 * (Equoria-ot1mo).
 *
 * Defect: the handler sent `error.message` verbatim for any error it did not
 * recognise, so a raw driver/ORM failure ("Can't reach database server at
 * 10.0.0.5:5432") was returned to an anonymous caller. These cases drive the
 * real middleware through a real Express app with supertest: an internal
 * (non-operational) 500 answers with a generic message while the detail stays
 * in the server log, and curated AppError messages still reach the player.
 */

import { describe, it, expect, afterEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import errorHandler from '../middleware/errorHandler.mjs';
import { AppError, DatabaseError } from '../errors/index.mjs';
import logger from '../utils/logger.mjs';

const INTERNAL_DETAIL = "Can't reach database server at 10.0.0.5:5432";

function appThrowing(makeError) {
  const app = express();
  app.get('/boom', (_req, _res, next) => next(makeError()));
  app.use(errorHandler);
  return app;
}

describe('errorHandler — internal 500 messages (Equoria-ot1mo)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('answers a raw internal Error with a generic message and logs the detail', async () => {
    const logSpy = jest.spyOn(logger, 'error');
    const res = await request(appThrowing(() => new Error(INTERNAL_DETAIL))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
    expect(logSpy.mock.calls.some(args => JSON.stringify(args).includes(INTERNAL_DETAIL))).toBe(true);
  });

  it('answers a raw Error carrying an explicit 5xx statusCode with a generic message', async () => {
    const res = await request(appThrowing(() => Object.assign(new Error(INTERNAL_DETAIL), { statusCode: 503 }))).get(
      '/boom',
    );

    expect(res.status).toBe(503);
    expect(res.body.message).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('answers a non-operational AppError 500 with a generic message', async () => {
    const res = await request(appThrowing(() => new AppError(INTERNAL_DETAIL, 500, false))).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal Server Error');
  });

  it('answers a DatabaseError (which wraps raw driver text) with a generic message', async () => {
    const res = await request(
      appThrowing(() => new DatabaseError(`Lookup failed: ${INTERNAL_DETAIL}`, new Error(INTERNAL_DETAIL))),
    ).get('/boom');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('10.0.0.5');
  });

  it('still returns a curated AppError message to the player', async () => {
    const res = await request(appThrowing(() => new AppError('Invalid credentials', 401))).get('/boom');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('still returns a curated operational AppError 500 message to the player', async () => {
    const res = await request(appThrowing(() => new AppError('Login failed due to an unexpected error.', 500))).get(
      '/boom',
    );

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Login failed due to an unexpected error.');
  });

  it('still returns a client (4xx) error message from a non-AppError', async () => {
    const res = await request(
      appThrowing(() => Object.assign(new Error('Unexpected token } in JSON'), { statusCode: 400 })),
    ).get('/boom');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Unexpected token } in JSON');
  });
});
