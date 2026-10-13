/**
 * Gmail API email transport (Equoria-s4rf4).
 *
 * Railway blocks outbound SMTP on the owner's plan, so production mail goes
 * through the Gmail API over HTTPS. Google is a genuine third-party boundary
 * with no safe sandbox, so it is stood up here as a local node:http server and
 * the real Equoria transport and emailService code run against it. Nothing in
 * Equoria is mocked.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import http from 'node:http';
import { URLSearchParams } from 'node:url';
import { createGmailApiTransport, readGmailConfig } from '../utils/gmailApiTransport.mjs';
import { sendStaffCheckinCodeEmail, _resetTransporter } from '../utils/emailService.mjs';

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const CLIENT_SECRET = 'GOCSPX-test-client-secret-s4rf4';
const REFRESH_TOKEN = '1//test-refresh-token-s4rf4';
const ACCESS_TOKEN = 'ya29.test-access-token-s4rf4';

// ---- the fake Google -------------------------------------------------------

const requests = [];
const sockets = new Set();
let tokenHandler;
let sendHandler;
let tokenCount;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const google = http.createServer((req, res) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    const entry = { method: req.method, url: req.url, headers: req.headers, body: data };
    requests.push(entry);
    if (req.url === '/token') {
      tokenHandler(res, entry);
    } else if (req.url === '/gmail/v1/users/me/messages/send') {
      sendHandler(res, entry);
    } else {
      json(res, 404, { error: { status: 'NOT_FOUND', message: 'no route' } });
    }
  });
});
google.on('connection', socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

let baseUrl;

beforeAll(async () => {
  await new Promise(resolve => google.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${google.address().port}`;
});

afterAll(async () => {
  for (const socket of sockets) {
    socket.destroy();
  }
  await new Promise(resolve => google.close(resolve));
});

beforeEach(() => {
  requests.length = 0;
  tokenCount = 0;
  tokenHandler = res => {
    tokenCount += 1;
    json(res, 200, { access_token: `${ACCESS_TOKEN}-${tokenCount}`, expires_in: 3599, token_type: 'Bearer' });
  };
  sendHandler = res => json(res, 200, { id: 'gmail-msg-1', threadId: 't-1', labelIds: ['SENT'] });
});

const tokenRequests = () => requests.filter(r => r.url === '/token');
const sendRequests = () => requests.filter(r => r.url === '/gmail/v1/users/me/messages/send');
const decodeRaw = entry => Buffer.from(JSON.parse(entry.body).raw, 'base64url').toString('utf8');

function makeTransport(overrides = {}) {
  return createGmailApiTransport({
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    refreshToken: REFRESH_TOKEN,
    sender: 'equoriagame@gmail.com',
    oauthUrl: `${baseUrl}/token`,
    apiUrl: baseUrl,
    ...overrides,
  });
}

const MAIL = {
  from: '"Equoria" <equoriagame@gmail.com>',
  to: 'rider@example.com',
  subject: 'Your foal has arrived',
  text: 'A bay filly was born in the north paddock.',
  html: '<p>A bay filly was born in the north paddock.</p>',
};

// ---- the transport ---------------------------------------------------------

describe('Gmail API transport', () => {
  it('refreshes a token with the right form fields and sends the composed message', async () => {
    const result = await makeTransport().sendMail(MAIL);

    expect(result).toEqual({ messageId: 'gmail-msg-1' });
    const [token] = tokenRequests();
    expect(token.method).toBe('POST');
    expect(token.headers['content-type']).toMatch(/application\/x-www-form-urlencoded/);
    const form = new URLSearchParams(token.body);
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
    });

    const [send] = sendRequests();
    expect(send.method).toBe('POST');
    expect(send.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}-1`);
    const raw = decodeRaw(send);
    expect(raw).toMatch(/^To: rider@example\.com$/m);
    expect(raw).toMatch(/^Subject: Your foal has arrived$/m);
    expect(raw).toMatch(/^From: Equoria <equoriagame@gmail\.com>$/m);
    expect(raw).toContain('A bay filly was born in the north paddock.');
  });

  it('uses the sender as From when the message names none', async () => {
    const { from, ...withoutFrom } = MAIL;
    expect(from).toBeDefined();
    await makeTransport().sendMail(withoutFrom);
    expect(decodeRaw(sendRequests()[0])).toMatch(/^From: equoriagame@gmail\.com$/m);
  });

  it('caches the token: two sends make one token request, concurrent sends share one refresh', async () => {
    const transport = makeTransport();
    await transport.sendMail(MAIL);
    await transport.sendMail(MAIL);
    expect(tokenRequests()).toHaveLength(1);
    expect(sendRequests()).toHaveLength(2);

    const fresh = makeTransport();
    await Promise.all([fresh.sendMail(MAIL), fresh.sendMail(MAIL), fresh.sendMail(MAIL)]);
    expect(tokenRequests()).toHaveLength(2);
    expect(sendRequests()).toHaveLength(5);
  });

  it('on a 401 refreshes once and retries once', async () => {
    let sends = 0;
    sendHandler = res => {
      sends += 1;
      if (sends === 1) {
        json(res, 401, { error: { code: 401, status: 'UNAUTHENTICATED', message: 'Invalid Credentials' } });
      } else {
        json(res, 200, { id: 'gmail-msg-retried' });
      }
    };

    const result = await makeTransport().sendMail(MAIL);

    expect(result.messageId).toBe('gmail-msg-retried');
    expect(tokenRequests()).toHaveLength(2);
    const [first, second] = sendRequests();
    expect(sendRequests()).toHaveLength(2);
    expect(first.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}-1`);
    expect(second.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}-2`);
  });

  it('a second 401 fails rather than looping', async () => {
    sendHandler = res => json(res, 401, { error: { status: 'UNAUTHENTICATED', message: 'Invalid Credentials' } });
    await expect(makeTransport().sendMail(MAIL)).rejects.toThrow(/HTTP 401/);
    expect(sendRequests()).toHaveLength(2);
    expect(tokenRequests()).toHaveLength(2);
  });

  it('a 500 from Google names the status and leaks no secret, token or message content', async () => {
    sendHandler = res => json(res, 500, { error: { code: 500, status: 'INTERNAL', message: 'Backend Error' } });

    let caught;
    try {
      await makeTransport().sendMail(MAIL);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toMatch(/HTTP 500/);
    expect(caught.message).toMatch(/INTERNAL/);
    for (const text of [caught.message, caught.stack]) {
      expect(text).not.toContain(CLIENT_SECRET);
      expect(text).not.toContain(REFRESH_TOKEN);
      expect(text).not.toContain(ACCESS_TOKEN);
      expect(text).not.toContain('north paddock');
    }
  });

  it("a refused refresh names Google's error code and leaks no secret", async () => {
    tokenHandler = res =>
      json(res, 400, { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' });

    let caught;
    try {
      await makeTransport().sendMail(MAIL);
    } catch (error) {
      caught = error;
    }

    expect(caught.message).toMatch(/HTTP 400 invalid_grant/);
    for (const text of [caught.message, caught.stack]) {
      expect(text).not.toContain(CLIENT_SECRET);
      expect(text).not.toContain(REFRESH_TOKEN);
    }
    expect(sendRequests()).toHaveLength(0);
  });

  it('never caches a rejected refresh: the next send refreshes again and succeeds', async () => {
    tokenHandler = res => {
      tokenCount += 1;
      if (tokenCount === 1) {
        json(res, 400, { error: 'invalid_grant', error_description: 'Bad Request' });
      } else {
        json(res, 200, { access_token: `${ACCESS_TOKEN}-${tokenCount}`, expires_in: 3599 });
      }
    };
    const transport = makeTransport();

    await expect(transport.sendMail(MAIL)).rejects.toThrow(/HTTP 400 invalid_grant/);
    expect(sendRequests()).toHaveLength(0);

    const result = await transport.sendMail(MAIL);
    expect(result.messageId).toBe('gmail-msg-1');
    expect(tokenRequests()).toHaveLength(2);
    expect(sendRequests()).toHaveLength(1);
    expect(sendRequests()[0].headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}-2`);
  });

  it('rejects within timeoutMs when Google never answers', async () => {
    sendHandler = () => {}; // hold the request open forever

    const started = Date.now();
    await expect(makeTransport({ timeoutMs: 200 }).sendMail(MAIL)).rejects.toThrow(/timed out after 200 ms/);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

// ---- selection inside emailService -----------------------------------------

const ENV_KEYS = [
  'NODE_ENV',
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'GMAIL_SENDER',
  'GMAIL_OAUTH_URL',
  'GMAIL_API_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

async function withEnv(values, fn) {
  const saved = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, values);
  _resetTransporter();
  try {
    return await fn();
  } finally {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    _resetTransporter();
  }
}

const gmailEnv = () => ({
  GMAIL_CLIENT_ID: CLIENT_ID,
  GMAIL_CLIENT_SECRET: CLIENT_SECRET,
  GMAIL_REFRESH_TOKEN: REFRESH_TOKEN,
  GMAIL_OAUTH_URL: `${baseUrl}/token`,
  GMAIL_API_URL: baseUrl,
});

// A port nothing listens on: SMTP must never be tried while Gmail is selected.
const deadSmtpEnv = { SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'nobody', SMTP_PASS: 'nothing' };

describe('emailService transport selection', () => {
  it('sends a real staff check-in code email through the Gmail API, chosen over SMTP', async () => {
    const result = await withEnv({ NODE_ENV: 'production', ...gmailEnv(), ...deadSmtpEnv }, () =>
      sendStaffCheckinCodeEmail('steward@example.com', '482913'),
    );

    expect(result).toEqual({ success: true, messageId: 'gmail-msg-1' });
    expect(tokenRequests()).toHaveLength(1);
    const [send] = sendRequests();
    expect(send.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN}-1`);
    const raw = decodeRaw(send);
    expect(raw).toMatch(/^To: steward@example\.com$/m);
    expect(raw).toMatch(/^Subject: Your Steward's Office code$/m);
    expect(raw).toMatch(/^From: Equoria </m);
    expect(raw).toContain('482913');
  });

  it('half-configured Gmail throws in production and names the missing variables', async () => {
    await withEnv({ NODE_ENV: 'production', GMAIL_CLIENT_ID: CLIENT_ID, ...deadSmtpEnv }, async () => {
      await expect(sendStaffCheckinCodeEmail('steward@example.com', '111111')).rejects.toThrow(
        /Missing: GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN/,
      );
    });
    expect(requests).toHaveLength(0);
  });

  it('a whitespace-only GMAIL_REFRESH_TOKEN counts as missing in production', async () => {
    await withEnv({ NODE_ENV: 'production', ...gmailEnv(), GMAIL_REFRESH_TOKEN: '   ' }, async () => {
      await expect(sendStaffCheckinCodeEmail('steward@example.com', '444444')).rejects.toThrow(
        /Missing: GMAIL_REFRESH_TOKEN./,
      );
    });
    expect(requests).toHaveLength(0);
  });

  it('half-configured Gmail counts as not configured outside production', () => {
    expect(readGmailConfig({ NODE_ENV: 'test', GMAIL_REFRESH_TOKEN: REFRESH_TOKEN })).toBeNull();
    expect(readGmailConfig({ NODE_ENV: 'test' })).toBeNull();
    expect(() => readGmailConfig({ NODE_ENV: 'production', GMAIL_CLIENT_SECRET: CLIENT_SECRET })).toThrow(
      /Missing: GMAIL_CLIENT_ID, GMAIL_REFRESH_TOKEN/,
    );
  });

  it('production with neither Gmail nor SMTP configured throws, naming both options', async () => {
    await withEnv({ NODE_ENV: 'production' }, async () => {
      await expect(sendStaffCheckinCodeEmail('steward@example.com', '222222')).rejects.toThrow(
        /GMAIL_CLIENT_ID.*SMTP_HOST/s,
      );
    });
    expect(requests).toHaveLength(0);
  });

  it('non-production with nothing configured keeps the dev capture path', async () => {
    const result = await withEnv({ NODE_ENV: 'test' }, () =>
      sendStaffCheckinCodeEmail('steward@example.com', '333333'),
    );
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-mode-staff-checkin-/);
    expect(requests).toHaveLength(0);
  });
});
