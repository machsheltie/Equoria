/**
 * Email Service — Production SMTP Path Integration Test
 *
 * Validates that when NODE_ENV=production and SMTP_* env vars are set,
 * the email service actually invokes nodemailer's sendMail (and returns
 * its messageId), and that missing config fails loud rather than silently.
 *
 * Per Equoria-1bvm: prior to this wiring, production paths just
 * logger.warn'd and returned a no-op messageId, causing verification
 * + password-reset emails to silently fail in beta.
 *
 * Mocking nodemailer transport is allowed under balanced-mocking philosophy
 * (it's an external SMTP service — same class as DB/logger mocks). We are
 * NOT mocking emailService itself; we mock only the outbound network adapter.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Capture sendMail calls so we can assert on them.
const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'smtp-test-msg-id-123' });
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));

// ESM mock of nodemailer BEFORE dynamic-importing the service under test.
jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: createTransportMock },
}));

let sendVerificationEmail;
let sendWelcomeEmail;
let sendPasswordResetEmail;
let _resetTransporter;

const ORIGINAL_ENV = { ...process.env };

beforeEach(async () => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  // Force fresh module load so our nodemailer mock is wired up
  jest.resetModules();
  const mod = await import('../utils/emailService.mjs');
  sendVerificationEmail = mod.sendVerificationEmail;
  sendWelcomeEmail = mod.sendWelcomeEmail;
  sendPasswordResetEmail = mod.sendPasswordResetEmail;
  _resetTransporter = mod._resetTransporter;
  _resetTransporter();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('Email service — production SMTP wiring', () => {
  it('verification email: invokes SMTP transport in production when SMTP env is set', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'email-smtp.us-east-1.amazonaws.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'AKIAEXAMPLE';
    process.env.SMTP_PASS = 'examplepass';
    process.env.EMAIL_FROM = 'noreply@equoria.com';

    const result = await sendVerificationEmail('user@example.com', 'verify-tok-1');

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'email-smtp.us-east-1.amazonaws.com',
        port: 587,
        auth: expect.objectContaining({ user: 'AKIAEXAMPLE', pass: 'examplepass' }),
      }),
    );
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const sendArg = sendMailMock.mock.calls[0][0];
    expect(sendArg.to).toBe('user@example.com');
    expect(sendArg.subject).toMatch(/Verify Your Email/i);
    expect(sendArg.html).toContain('verify-tok-1');
    expect(sendArg.text).toContain('verify-tok-1');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('smtp-test-msg-id-123');
  });

  it('password reset: invokes SMTP transport in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.resend.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_PASS = 're_apikey_example';

    const result = await sendPasswordResetEmail('user@example.com', 'reset-tok-9');

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.resend.com', port: 465, secure: true }),
    );
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const sendArg = sendMailMock.mock.calls[0][0];
    expect(sendArg.to).toBe('user@example.com');
    expect(sendArg.subject).toMatch(/Reset Your Equoria Password/i);
    expect(sendArg.html).toContain('reset-tok-9');
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('smtp-test-msg-id-123');
  });

  it('welcome email: invokes SMTP transport in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_USER = 'u';
    process.env.SMTP_PASS = 'p';

    const result = await sendWelcomeEmail('user@example.com', { firstName: 'Ada' });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('smtp-test-msg-id-123');
  });

  it('production with NO SMTP config: fails loud (throws), does not silently drop the email', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    await expect(sendVerificationEmail('user@example.com', 'tok')).rejects.toThrow(/SMTP not configured/i);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('non-production with NO SMTP config: dev-mode path still works (does not call SMTP)', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    const result = await sendVerificationEmail('user@example.com', 'tok');
    expect(sendMailMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.messageId).toMatch(/^dev-mode/);
  });
});
