import { describe, it, expect } from '@jest/globals';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../../../utils/emailService.mjs';

// Tests run in NODE_ENV=test, so dev-mode paths execute (no real email sent).

describe('sendVerificationEmail', () => {
  it('returns success: true in test mode', async () => {
    const result = await sendVerificationEmail('test@example.com', 'abc123');
    expect(result.success).toBe(true);
  });

  it('messageId starts with dev-mode in test mode', async () => {
    const result = await sendVerificationEmail('test@example.com', 'tok-xyz');
    expect(result.messageId).toMatch(/^dev-mode/);
  });

  it('preview contains the token', async () => {
    const token = 'unique-verify-token-99';
    const result = await sendVerificationEmail('test@example.com', token);
    expect(result.preview).toContain(token);
  });

  it('preview is a URL string', async () => {
    const result = await sendVerificationEmail('user@equoria.com', 'mytoken');
    expect(typeof result.preview).toBe('string');
    expect(result.preview).toMatch(/https?:\/\//);
  });

  it('works with no user argument', async () => {
    await expect(sendVerificationEmail('a@b.com', 't1')).resolves.toMatchObject({ success: true });
  });

  it('works with firstName in user object', async () => {
    const result = await sendVerificationEmail('x@y.com', 'tok', { firstName: 'Ada' });
    expect(result.success).toBe(true);
  });

  it('works with username in user object', async () => {
    const result = await sendVerificationEmail('x@y.com', 'tok', { username: 'ada_rider' });
    expect(result.success).toBe(true);
  });
});

describe('sendWelcomeEmail', () => {
  it('returns success: true in test mode', async () => {
    const result = await sendWelcomeEmail('test@example.com');
    expect(result.success).toBe(true);
  });

  it('messageId starts with dev-mode-welcome in test mode', async () => {
    const result = await sendWelcomeEmail('test@example.com');
    expect(result.messageId).toMatch(/^dev-mode-welcome/);
  });

  it('works without user argument', async () => {
    await expect(sendWelcomeEmail('a@b.com')).resolves.toMatchObject({ success: true });
  });

  it('works with firstName in user object', async () => {
    const result = await sendWelcomeEmail('a@b.com', { firstName: 'Rider' });
    expect(result.success).toBe(true);
  });

  it('does not include preview in welcome result (no token needed)', async () => {
    const result = await sendWelcomeEmail('a@b.com');
    // Welcome email has no token/URL to preview
    expect(result).not.toHaveProperty('preview');
  });
});

describe('sendPasswordResetEmail', () => {
  it('returns success: true in test mode', async () => {
    const result = await sendPasswordResetEmail('test@example.com', 'reset-tok');
    expect(result.success).toBe(true);
  });

  it('messageId starts with dev-mode-password-reset in test mode', async () => {
    const result = await sendPasswordResetEmail('test@example.com', 'reset-tok');
    expect(result.messageId).toMatch(/^dev-mode-password-reset/);
  });

  it('preview contains the reset token', async () => {
    const token = 'unique-reset-77';
    const result = await sendPasswordResetEmail('test@example.com', token);
    expect(result.preview).toContain(token);
  });

  it('preview is a URL string', async () => {
    const result = await sendPasswordResetEmail('user@equoria.com', 'tok2');
    expect(typeof result.preview).toBe('string');
    expect(result.preview).toMatch(/https?:\/\//);
  });

  it('works without user argument', async () => {
    await expect(sendPasswordResetEmail('a@b.com', 'tok3')).resolves.toMatchObject({
      success: true,
    });
  });

  it('works with firstName in user object', async () => {
    const result = await sendPasswordResetEmail('x@y.com', 'tok4', { firstName: 'Lena' });
    expect(result.success).toBe(true);
  });
});
