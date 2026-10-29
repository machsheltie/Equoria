/**
 * Equoria-rit5r: body-parser 1.20.8 lets a gzip request body with trailing junk throw past
 * every handler and crash the process (Dependabot #290/#295). The app parses JSON and
 * urlencoded bodies with inflate:false, so a compressed body is refused with 415 before it
 * is ever decompressed, and the server keeps answering.
 */
import { describe, it, expect } from '@jest/globals';
import { gzipSync } from 'node:zlib';
import request from 'supertest';
import app from '../app.mjs';

function gzipWithTrailingJunk(payload) {
  return Buffer.concat([gzipSync(Buffer.from(payload)), Buffer.from('junk-after-the-stream')]);
}

describe('compressed request bodies (Equoria-rit5r)', () => {
  it('refuses a gzip JSON body with 415 instead of decompressing it', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipWithTrailingJunk(JSON.stringify({ email: 'a@b.c', password: 'x' })));
    expect(res.status).toBe(415);
  });

  it('refuses a gzip urlencoded body with 415', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .set('Content-Encoding', 'gzip')
      .send(gzipWithTrailingJunk('email=a%40b.c&password=x'));
    expect(res.status).toBe(415);
  });

  it('keeps answering after a refused compressed body', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(gzipWithTrailingJunk('{}'));
    const health = await request(app).get('/health');
    expect(health.status).toBeLessThan(500);
  });
});
