/**
 * The query cache honours REDIS_URL and REDIS_DISABLED (Equoria-5m00f, ARCH-03).
 *
 * Before: initializeRedis skipped Redis only for NODE_ENV=test and always built
 * new Redis({ host: REDIS_HOST || 'localhost', ... }), so a deploy that sets only
 * REDIS_URL (as the rate limiter reads) sent the cache to localhost, and
 * REDIS_DISABLED=true still constructed and connected a client.
 *
 * createCacheRedisClient(env) is the real factory initializeRedis uses. Clients
 * are lazy (lazyConnect), so these tests open no connection; each built client
 * is disconnected afterwards.
 */

import { describe, it, expect, afterEach } from '@jest/globals';
import { createCacheRedisClient } from '../utils/cacheHelper.mjs';

// A deployable env with no test signals: NODE_ENV and JEST_WORKER_ID are left
// out on purpose so only the variables under test decide.
const productionEnv = extra => ({ NODE_ENV: 'production', ...extra });

const built = [];
function build(env) {
  const client = createCacheRedisClient(env);
  if (client) {
    built.push(client);
  }
  return client;
}

afterEach(() => {
  while (built.length > 0) {
    built.pop().disconnect();
  }
});

describe('createCacheRedisClient (Equoria-5m00f)', () => {
  it('connects to REDIS_URL when only REDIS_URL is set', () => {
    const client = build(productionEnv({ REDIS_URL: 'redis://cache.example.internal:6390/2' }));

    expect(client).not.toBeNull();
    expect(client.options.host).toBe('cache.example.internal');
    expect(client.options.port).toBe(6390);
    expect(client.options.db).toBe(2);
    expect(client.status).toBe('wait'); // lazy: nothing opened
  });

  it('prefers REDIS_URL over REDIS_HOST/REDIS_PORT', () => {
    const client = build(
      productionEnv({
        REDIS_URL: 'redis://url-host.example.internal:6391',
        REDIS_HOST: 'host-var.example.internal',
        REDIS_PORT: '7000',
      }),
    );

    expect(client.options.host).toBe('url-host.example.internal');
    expect(client.options.port).toBe(6391);
  });

  it('uses REDIS_PASSWORD only when REDIS_URL carries no password', () => {
    const fromVar = build(
      productionEnv({ REDIS_URL: 'redis://cache.example.internal:6390', REDIS_PASSWORD: 'varSecret' }),
    );
    expect(fromVar.options.password).toBe('varSecret');

    const fromUrl = build(
      productionEnv({
        REDIS_URL: 'redis://:urlSecret@cache.example.internal:6390',
        REDIS_PASSWORD: 'varSecret',
      }),
    );
    expect(fromUrl.options.password).toBe('urlSecret');
  });

  it('falls back to REDIS_HOST/REDIS_PORT/REDIS_DB without REDIS_URL', () => {
    const client = build(productionEnv({ REDIS_HOST: 'host-var.example.internal', REDIS_PORT: '7001', REDIS_DB: '3' }));

    expect(client.options.host).toBe('host-var.example.internal');
    expect(client.options.port).toBe(7001);
    expect(client.options.db).toBe(3);
  });

  it('never constructs a client when REDIS_DISABLED=true', () => {
    expect(
      build(productionEnv({ REDIS_DISABLED: 'true', REDIS_URL: 'redis://cache.example.internal:6390' })),
    ).toBeNull();
  });

  it('never constructs a client under test or Jest', () => {
    expect(build({ NODE_ENV: 'test', REDIS_URL: 'redis://cache.example.internal:6390' })).toBeNull();
    expect(
      build({ NODE_ENV: 'production', JEST_WORKER_ID: '1', REDIS_URL: 'redis://cache.example.internal:6390' }),
    ).toBeNull();
  });
});
