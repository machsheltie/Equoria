# TECH-SPEC-01: Authentication Implementation

**Status:** Draft
**Version:** 1.0.0
**Created:** 2025-12-02
**Source:** AUTH_IMPLEMENTATION_PLAN.md, GENERAL_RULES.md

---

## Overview

Comprehensive 3-week authentication implementation to secure the Equoria platform. This spec addresses the current XSS vulnerability (tokens in localStorage) and implements enterprise-grade security.

## Current State (Vulnerabilities)

```javascript
// CURRENT VULNERABLE APPROACH:
res.json({ token: "eyJhbGc...", refreshToken: "abc123..." });
// Tokens stored in localStorage = XSS vulnerability
```

## Target State

```javascript
// SECURE APPROACH:
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000 // 15 minutes
});
```

---

## Phase 1: Security Foundations (Week 1)

### 1.1 HttpOnly Cookie Migration

**Priority:** P0 - Critical
**Estimated Hours:** 8-10

**Tasks:**
1. Update `backend/middleware/auth.mjs` for cookie-based authentication
2. Configure Express cookie-parser with secure options
3. Implement CSRF protection with double-submit cookie pattern
4. Update refresh token flow for cookie rotation
5. Add SameSite=Strict configuration

**Files to Modify:**
- `backend/middleware/auth.mjs`
- `backend/controllers/authController.mjs`
- `backend/routes/auth.mjs`
- `backend/app.mjs`

**Schema Changes:** None required

**Test Requirements:**
- Cookie setting verification
- CSRF token validation
- Cross-site request rejection
- Token refresh flow

### 1.2 Rate Limiting Enhancement

**Priority:** P0 - Critical
**Estimated Hours:** 4-6

**Tasks:**
1. Configure endpoint-specific rate limits
2. Add progressive backoff for failed login attempts
3. Implement IP-based rate limiting with Redis backing
4. Add account lockout after 5 failed attempts (30-minute lockout)

**Configuration:**
```javascript
const authRateLimits = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  register: { windowMs: 60 * 60 * 1000, max: 3 },
  passwordReset: { windowMs: 60 * 60 * 1000, max: 3 },
  tokenRefresh: { windowMs: 15 * 60 * 1000, max: 10 }
};
```

### 1.3 Token Rotation

**Priority:** P1 - High
**Estimated Hours:** 6-8

**Tasks:**
1. Implement refresh token family tracking
2. Add token version/generation tracking in database
3. Invalidate entire token family on suspicious activity
4. Implement token usage logging for audit

**Schema Changes:**
```prisma
model RefreshToken {
  id            Int       @id @default(autoincrement())
  token         String    @unique
  userId        String
  familyId      String    // NEW: Token family for rotation
  generation    Int       @default(0) // NEW: Token generation
  expiresAt     DateTime
  isActive      Boolean   @default(true)
  isInvalidated Boolean   @default(false)
  lastActivityAt DateTime?
  createdAt     DateTime  @default(now())
  user          User      @relation(fields: [userId], references: [id])

  @@index([familyId])
  @@index([userId])
}
```

### 1.4 Email Verification

**Priority:** P1 - High
**Estimated Hours:** 8-10

**Tasks:**
1. Create EmailVerificationToken model
2. Generate 256-bit secure verification tokens
3. Implement 24-hour token expiration
4. Add verification endpoint
5. Configure email sending (SendGrid/AWS SES)
6. Block unverified users from sensitive actions

**New Endpoints:**
- `POST /api/auth/send-verification` - Send verification email
- `GET /api/auth/verify-email/:token` - Verify email token
- `POST /api/auth/resend-verification` - Resend verification

---

## Phase 2: Social Login (Week 2)

### 2.1 Google OAuth 2.0

**Priority:** P1 - High
**Estimated Hours:** 10-12

**Tasks:**
1. Configure Google OAuth credentials
2. Implement OAuth callback handler
3. Handle account linking for existing users
4. Create new accounts for new social users
5. Store OAuth refresh tokens securely

**New Files:**
- `backend/services/oauthService.mjs`
- `backend/controllers/socialAuthController.mjs`
- `backend/routes/socialAuth.mjs`

**Endpoints:**
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - OAuth callback

### 2.2 Apple Sign In

**Priority:** P2 - Medium
**Estimated Hours:** 8-10

**Tasks:**
1. Configure Apple Developer credentials
2. Implement SIWA server-side validation
3. Handle name/email scoping (Apple only provides on first auth)
4. Implement account linking

---

## Phase 3: Enhanced Features (Week 3)

### 3.1 Password Reset Flow

**Priority:** P1 - High
**Estimated Hours:** 6-8

**Tasks:**
1. Create PasswordResetToken model
2. Generate secure reset tokens (1-hour expiration)
3. Send reset emails
4. Validate token and update password
5. Invalidate all user sessions after password change

**Endpoints:**
- `POST /api/auth/forgot-password` - Initiate reset
- `POST /api/auth/reset-password` - Complete reset

### 3.2 Multi-Device Session Management

**Priority:** P2 - Medium
**Estimated Hours:** 8-10

**Tasks:**
1. Track active sessions per user
2. Allow users to view active sessions
3. Enable remote session termination
4. Add "Log out all devices" feature
5. Implement device fingerprinting

**New Endpoints:**
- `GET /api/auth/sessions` - List active sessions
- `DELETE /api/auth/sessions/:sessionId` - Terminate session
- `DELETE /api/auth/sessions/all` - Terminate all sessions

---

## Frontend Integration

### Required UI Components

1. **Login Screen**
   - Email/password form
   - Social login buttons (Google, Apple)
   - "Remember me" checkbox
   - Forgot password link

2. **Registration Screen**
   - Email/username/password form
   - Password strength indicator
   - Terms acceptance checkbox
   - Social registration options

3. **Email Verification Screen**
   - Verification status display
   - Resend verification button
   - Auto-redirect on verification

4. **Password Reset Screen**
   - Email input for reset request
   - New password form with confirmation
   - Password requirements display

5. **Session Management Screen**
   - Active sessions list
   - Device/browser info
   - Logout individual/all buttons

---

## Security Checklist

- [ ] HttpOnly cookies for tokens
- [ ] Secure flag in production
- [ ] SameSite=Strict
- [ ] CSRF protection
- [ ] Rate limiting on all auth endpoints
- [ ] Account lockout on failed attempts
- [ ] Token family rotation
- [ ] Email verification required
- [ ] Password complexity requirements
- [ ] Secure password reset flow
- [ ] Session timeout (30 minutes inactivity)
- [ ] Force logout on password change

---

## Testing Requirements

### Unit Tests
- Token generation and validation
- Cookie setting with correct attributes
- Rate limiting behavior
- Password hashing and verification

### Integration Tests
- Full login/logout flow
- Token refresh cycle
- Email verification flow
- Social login integration
- Session management

### Security Tests
- XSS token extraction attempts
- CSRF attack simulation
- Brute force protection verification
- Token reuse detection

---

## Acceptance Criteria

1. All auth tokens stored in HttpOnly cookies
2. No tokens exposed in JavaScript/localStorage
3. Rate limiting prevents brute force attacks
4. Token rotation detects suspicious activity
5. Email verification blocks unverified users
6. Password reset flow is secure and user-friendly
7. All sessions can be managed by user
8. 100% test coverage on auth endpoints
