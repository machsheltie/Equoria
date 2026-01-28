# Sentry Error Tracking and Security Monitoring Setup

## Overview

Equoria integrates Sentry for comprehensive error tracking, performance monitoring, and security event alerting. This guide explains how to set up and configure Sentry for production use.

## Features

- **Error Tracking**: Automatic error capture with stack traces and context
- **Performance Monitoring**: Request tracing and profiling
- **Security Alerts**: Automatic detection and alerting for security events
- **Release Tracking**: Version-specific error tracking
- **Custom Security Events**: Track auth failures, IDOR attempts, rate limit violations

## Setup

### 1. Create Sentry Account

1. Go to [https://sentry.io](https://sentry.io)
2. Create an account (free tier available)
3. Create a new project
4. Select **Node.js** as the platform

### 2. Get Your DSN

After creating a project, Sentry will provide you with a DSN (Data Source Name). It looks like:

```
https://examplePublicKey@o0.ingest.sentry.io/0
```

### 3. Configure Environment Variables

Add your Sentry DSN to your `.env` file:

```env
# Production
SENTRY_DSN=https://your-actual-dsn-here@o0.ingest.sentry.io/0
SENTRY_RELEASE=equoria@1.0.0
NODE_ENV=production

# Development (optional - usually disabled)
# SENTRY_DSN=https://your-dev-dsn@o0.ingest.sentry.io/0
# NODE_ENV=development
```

**Important**: Only set `SENTRY_DSN` in production. Development and test environments will skip Sentry initialization if DSN is not configured.

### 4. Verify Integration

Start your server and trigger a test error:

```bash
npm run start
```

Check your Sentry dashboard for incoming events.

## Security Event Types

Sentry automatically tracks these security events:

### Authentication Events

- **AUTH_FAILURE**: Failed login attempts
- **AUTH_SUCCESS**: Successful authentication
- **TOKEN_EXPIRED**: Expired JWT tokens
- **TOKEN_INVALID**: Invalid JWT tokens

### Authorization Events

- **IDOR_ATTEMPT**: Insecure Direct Object Reference attempts
- **OWNERSHIP_VIOLATION**: Access to resources not owned by user
- **PRIVILEGE_ESCALATION**: Unauthorized role access attempts

### Rate Limiting

- **RATE_LIMIT_EXCEEDED**: Rate limit threshold violations
- **SUSPICIOUS_ACTIVITY**: Detected suspicious behavior patterns

### Input Validation

- **VALIDATION_FAILURE**: Input validation errors
- **XSS_ATTEMPT**: Cross-site scripting attempts
- **SQL_INJECTION_ATTEMPT**: SQL injection attempts

### Information Disclosure

- **SENSITIVE_DATA_EXPOSURE**: Potential sensitive data leaks
- **ERROR_LEAK**: Stack traces or error details exposed

## Alert Thresholds

Security events automatically escalate to **critical** severity when thresholds are exceeded:

| Event Type            | Threshold | Time Window |
| --------------------- | --------- | ----------- |
| Auth Failures         | 5 events  | 15 minutes  |
| IDOR Attempts         | 3 events  | 10 minutes  |
| Rate Limit Exceeded   | 10 events | 5 minutes   |
| Ownership Violations  | 3 events  | 10 minutes  |
| Privilege Escalation  | 1 event   | Immediate   |
| XSS Attempt           | 1 event   | Immediate   |
| SQL Injection Attempt | 1 event   | Immediate   |

## Custom Alert Rules

Configure alert rules in your Sentry dashboard:

### 1. Critical Security Events

**Condition**: Event tag `security_event` equals any of:

- `privilege_escalation`
- `xss_attempt`
- `sql_injection_attempt`

**Action**: Send email + Slack notification

### 2. Excessive Auth Failures

**Condition**: Event count > 10 in 5 minutes for `security_event:auth_failure`

**Action**: Send email to security team

### 3. Suspicious Activity Pattern

**Condition**: Event tag `security_event` equals `suspicious_activity`

**Action**: Create Jira ticket + Send Slack notification

## Performance Monitoring

Sentry captures performance data for all requests:

### Sample Rates

**Production**:

- Transaction sampling: 10% (to reduce overhead)
- Profiling sampling: 10%

**Development**:

- Transaction sampling: 100% (for debugging)
- Profiling sampling: 100%

### Customizing Sample Rates

Edit `backend/config/sentry.mjs`:

```javascript
Sentry.init({
  tracesSampleRate: 0.25, // Sample 25% of transactions
  profilesSampleRate: 0.1, // Profile 10% of transactions
});
```

## Sentry Dashboard

### Key Metrics to Monitor

1. **Issues**: Total error count and error rate
2. **Performance**: Average response times and slow transactions
3. **Security Events**: Count of security-related events
4. **Releases**: Error rates by deployment version

### Useful Queries

**Most Common Errors**:

```
is:unresolved
```

**Security Events Only**:

```
event_type:security
```

**High Severity Only**:

```
level:error OR level:critical
```

**Recent Auth Failures**:

```
security_event:auth_failure
```

## Integration with Audit Logs

Sentry security events are automatically integrated with Equoria's audit logging system:

1. **High-sensitivity operations** are logged to both Sentry and audit logs
2. **Suspicious activity detection** triggers Sentry alerts
3. **Authentication failures** are tracked in Sentry with IP-based thresholds
4. **Ownership violations** are escalated to Sentry when detected

## Best Practices

### 1. Environment Separation

Use different Sentry projects for different environments:

- **equoria-production**: Production DSN
- **equoria-staging**: Staging DSN
- **equoria-development**: Development DSN (optional)

### 2. Release Tracking

Set `SENTRY_RELEASE` to your application version:

```env
SENTRY_RELEASE=equoria@1.2.3
```

This allows you to:

- Track errors by release version
- Identify which deployments introduced errors
- Set up release-based alerts

### 3. Source Maps (Future)

For better stack traces, upload source maps:

```bash
npx @sentry/cli releases files <release> upload-sourcemaps ./dist
```

### 4. Custom Context

Add custom context to errors for better debugging:

```javascript
import { Sentry } from './config/sentry.mjs';

Sentry.setContext('game_state', {
  horseId: 123,
  userId: 456,
  action: 'training',
});
```

### 5. User Identification

Sentry automatically captures user info from JWT tokens, but you can add more:

```javascript
Sentry.setUser({
  id: user.id,
  email: user.email,
  username: user.username,
  subscription_tier: 'premium',
});
```

## Troubleshooting

### Sentry Not Capturing Errors

1. Check `SENTRY_DSN` is set correctly in `.env`
2. Verify `NODE_ENV` is not 'test'
3. Check Sentry dashboard for project status
4. Look for errors in server logs: `[Sentry]`

### Too Many Events

If you're hitting Sentry quotas:

1. Reduce sample rates in `backend/config/sentry.mjs`
2. Add more entries to `ignoreErrors` array
3. Filter out noisy errors in Sentry dashboard

### Missing Security Events

Ensure audit logging is properly configured:

1. Check `auditLog` middleware is attached to routes
2. Verify `operationType` matches expected values
3. Check Winston logging is working

## Cost Optimization

### Free Tier Limits

Sentry free tier includes:

- 5,000 errors per month
- 10,000 transactions per month
- 1 team member
- 30-day data retention

### Optimization Strategies

1. **Reduce Sample Rates**: Set `tracesSampleRate` to 0.05 (5%)
2. **Filter Noisy Errors**: Add common errors to `ignoreErrors`
3. **Use Different Projects**: Separate staging/dev from production
4. **Rate Limit Events**: Use Sentry's inbound filters

## Security Considerations

### Data Privacy

Sentry captures:

- ✅ Error messages and stack traces
- ✅ Request URLs and methods
- ✅ User IDs (hashed)
- ❌ Passwords (automatically filtered)
- ❌ JWT tokens (automatically filtered)
- ❌ Credit card data (should not be present)

### Sensitive Data Filtering

Sentry automatically scrubs sensitive data, but you can add custom filters:

```javascript
beforeSend(event) {
  // Remove sensitive data from breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.filter(
      breadcrumb => !breadcrumb.message.includes('password')
    );
  }
  return event;
}
```

## Support

- **Sentry Documentation**: [https://docs.sentry.io](https://docs.sentry.io)
- **Sentry Node SDK**: [https://docs.sentry.io/platforms/node/](https://docs.sentry.io/platforms/node/)
- **Equoria Security**: See `SECURITY.md` for security policies

## Related Documentation

- [SECURITY.md](../SECURITY.md) - Security policies and procedures
- [API_SECURITY.md](./api-contracts-backend/security-features.md) - API security features
- [AUDIT_LOGGING.md](./AUDIT_LOGGING.md) - Audit logging system (if exists)

---

_Last Updated: 2026-01-28_
_Version: 1.0_
