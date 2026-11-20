/**
 * The E2E port preflight (Equoria-8w3ax.3): the beta-readiness gate asks it
 * whether the E2E ports are free instead of killing whatever holds them.
 * Real listening sockets, no mocks.
 */
import net from 'node:net';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  describeBusyE2ePorts,
  findBusyE2ePorts,
  isPortInUse,
  resolveE2eBackendPort,
} from '../../tests/e2e/helpers/e2eTestStack.mjs';

const servers = [];

function listenOnFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    servers.push(server);
    server.once('error', reject);
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise(resolve => server.close(resolve))));
});

describe('E2E port preflight', () => {
  it('sees a port another process is listening on, and sees it free again after it stops', async () => {
    const { server, port } = await listenOnFreePort();
    expect(await isPortInUse(port)).toBe(true);
    await new Promise(resolve => server.close(resolve));
    expect(await isPortInUse(port)).toBe(false);
  });

  it('names the backend port when something holds it, and leaves that listener running', async () => {
    const { server, port } = await listenOnFreePort();
    const env = { EQUORIA_BACKEND_PORT: String(port) };
    const busy = await findBusyE2ePorts(env);
    expect(busy).toContainEqual({ role: 'E2E backend', port: String(port) });
    expect(server.listening).toBe(true);
    const message = describeBusyE2ePorts(busy);
    expect(message).toContain(`port ${port} (E2E backend)`);
    expect(message).toMatch(/never kills it/);
  });

  it('reports nothing for the backend when its port is free', async () => {
    const { server, port } = await listenOnFreePort();
    await new Promise(resolve => server.close(resolve));
    const busy = await findBusyE2ePorts({ EQUORIA_BACKEND_PORT: String(port) });
    expect(busy.find(entry => entry.role === 'E2E backend')).toBeUndefined();
  });

  it('uses the laptop port locally and 3001 in CI', () => {
    expect(resolveE2eBackendPort({})).toBe('3101');
    expect(resolveE2eBackendPort({ CI: 'true' })).toBe('3001');
    expect(resolveE2eBackendPort({ CI: 'true', EQUORIA_BACKEND_PORT: '3999' })).toBe('3999');
  });
});
