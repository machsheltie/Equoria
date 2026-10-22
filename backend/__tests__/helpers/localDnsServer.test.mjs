/**
 * localDnsServer helper (Equoria-l2ij4): the real Node resolver, pointed at the
 * local server, returns exactly the configured answers.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import dns from 'node:dns';
import { startLocalDnsServer } from './localDnsServer.mjs';

let server;
let previousServers;

beforeAll(async () => {
  previousServers = dns.getServers();
  server = await startLocalDnsServer({
    'public.test': ['203.0.113.7'],
    'both.test': ['203.0.113.8', '2001:0db8:0000:0000:0000:0000:0000:0001'],
    'loop.test': ['127.0.0.1'],
  });
  dns.setServers([`127.0.0.1:${server.port}`]);
});

afterAll(async () => {
  dns.setServers(previousServers);
  await server.close();
});

describe('localDnsServer', () => {
  it('answers A questions for a configured name', async () => {
    await expect(dns.promises.resolve4('public.test')).resolves.toEqual(['203.0.113.7']);
    await expect(dns.promises.resolve4('loop.test')).resolves.toEqual(['127.0.0.1']);
  });

  it('answers AAAA questions for a configured name', async () => {
    const addresses = await dns.promises.resolve6('both.test');
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toMatch(/^2001:db8::1$/i);
  });

  it('answers NODATA for a known name with no address of the requested family', async () => {
    await expect(dns.promises.resolve6('public.test')).rejects.toMatchObject({ code: 'ENODATA' });
  });

  it('answers NXDOMAIN for an unknown name', async () => {
    await expect(dns.promises.resolve4('unknown.test')).rejects.toMatchObject({ code: 'ENOTFOUND' });
  });
});
