# OWASP ZAP Security Scanner Integration

## Overview

OWASP ZAP (Zed Attack Proxy) is an automated security testing tool integrated into our CI/CD pipeline. It performs dynamic application security testing (DAST) to identify vulnerabilities in the running API.

**Last Updated:** 2025-12-10
**Story:** Story 7: Security Testing Suite (Task 3)
**Status:** ✅ Complete

---

## Features

### Automated Security Scans

1. **Baseline Scan** (Every push/PR)
   - Quick passive scan
   - Identifies common security issues
   - Runs in <5 minutes
   - Blocks merge on high-severity findings

2. **API Scan** (Every push/PR)
   - Uses OpenAPI specification for guided testing
   - Tests all documented endpoints
   - Validates authentication flows
   - Checks for OWASP Top 10 vulnerabilities

3. **Full Scan** (Weekly - Mondays 2 AM UTC)
   - Comprehensive active + passive scanning
   - Deep crawl of all endpoints
   - Fuzzing attacks on inputs
   - Runs for up to 2 hours

### Vulnerability Categories

ZAP tests for:
- **SQL Injection** (all variants: MySQL, PostgreSQL, SQLite, etc.)
- **XSS** (Reflected, Stored, DOM-based)
- **CSRF** (Anti-CSRF token validation)
- **Authentication Bypass** (JWT validation, session management)
- **Insecure Direct Object References** (IDOR)
- **Security Misconfiguration** (headers, CORS, cookies)
- **Path Traversal** (directory access)
- **Information Disclosure** (error messages, comments)
- **Rate Limiting** (DoS protection)
- **Cookie Security** (Secure, HttpOnly, SameSite flags)

---

## GitHub Actions Workflow

### Triggers

```yaml
on:
  push:
    branches: [master, develop]
  pull_request:
    branches: [master, develop]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Mondays
  workflow_dispatch:      # Manual trigger
```

### Environment Setup

The workflow automatically:
1. Starts PostgreSQL and Redis services
2. Installs dependencies and runs migrations
3. Generates Prisma client
4. Creates test environment configuration
5. Starts the API server on port 3000
6. Exports OpenAPI specification

### Scan Execution

```bash
# Baseline Scan (passive)
ZAP Baseline → HTTP://localhost:3000

# API Scan (active, OpenAPI-guided)
ZAP API Scan → backend/openapi-spec.json

# Full Scan (active + passive, weekly)
ZAP Full Scan → HTTP://localhost:3000
```

---

## Rules Configuration

**File:** `.github/zap-rules.tsv`

### Rule Format

```tsv
ID    THRESHOLD    [IGNORE]    [COMMENT]
10023 HIGH                     # SQL Injection
10202 IGNORE                   # False positive
```

### Thresholds

- **OFF**: Disable rule completely
- **LOW**: Alert on low-confidence findings
- **MEDIUM**: Alert on medium-confidence findings
- **HIGH**: Alert only on high-confidence findings
- **IGNORE**: Disable alerts for this rule

### Priority Levels

**HIGH Priority (Fails CI/CD):**
- SQL Injection (all variants)
- XSS (all types)
- Authentication bypass
- Path traversal
- Remote code execution

**MEDIUM Priority (Warning):**
- Missing security headers
- Information disclosure
- Cookie security issues
- CORS misconfiguration

**LOW Priority (Informational):**
- Suspicious comments
- Outdated JS libraries
- Minor configuration issues

---

## Results & Reporting

### Artifacts

After each scan, artifacts are uploaded:

1. **zap-baseline-report** (HTML)
   - Human-readable HTML report
   - Screenshots of findings
   - Recommended fixes

2. **zap-api-report** (JSON)
   - Machine-readable JSON report
   - Structured vulnerability data
   - Risk scores and evidence

### GitHub Security Tab

SARIF results are uploaded to GitHub Security:
- Navigate to: **Security → Code Scanning → ZAP Scan**
- View vulnerabilities by severity
- Track remediation progress
- Export findings for compliance

### GitHub Issues

High-severity findings trigger automatic GitHub issue creation:

```markdown
## 🚨 High Severity Security Vulnerabilities Detected

OWASP ZAP scan found **3 high severity issues**:

### 1. SQL Injection in /api/horses/:id
- **Risk**: High (Critical)
- **Confidence**: High
- **Description**: The parameter 'id' appears vulnerable to SQL injection
- **Solution**: Use parameterized queries
- **Reference**: https://owasp.org/www-community/attacks/SQL_Injection
```

---

## Local ZAP Testing

### Prerequisites

```bash
# Install Docker
docker --version

# Pull ZAP Docker image
docker pull owasp/zap2docker-stable
```

### Running Local Scans

#### Baseline Scan

```bash
# Start API server
cd backend
npm start

# Run ZAP baseline scan
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable \
  zap-baseline.py \
  -t http://host.docker.internal:3000 \
  -c .github/zap-rules.tsv \
  -r baseline-report.html \
  -J baseline-report.json
```

#### API Scan (OpenAPI)

```bash
# Export OpenAPI spec
curl http://localhost:3000/api-docs/swagger.json -o openapi-spec.json

# Run ZAP API scan
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable \
  zap-api-scan.py \
  -t http://host.docker.internal:3000 \
  -f openapi \
  -d openapi-spec.json \
  -c .github/zap-rules.tsv \
  -r api-report.html \
  -J api-report.json
```

#### Full Scan (Active + Passive)

```bash
# WARNING: Full scan runs active attacks - use only in test environments

docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable \
  zap-full-scan.py \
  -t http://host.docker.internal:3000 \
  -c .github/zap-rules.tsv \
  -m 5 \
  -T 60 \
  -r full-report.html \
  -J full-report.json
```

### Command Options

- `-t <target>`: Target URL to scan
- `-c <config>`: Rules configuration file
- `-r <file>`: HTML report output
- `-J <file>`: JSON report output
- `-m <minutes>`: Maximum scan duration
- `-T <minutes>`: Maximum time per spider
- `-a`: Include authentication
- `-j`: Use AJAX spider
- `-I`: Ignore scan policies

---

## Interpreting Results

### Risk Levels

| Risk | Priority | Action Required |
|------|----------|-----------------|
| **High** | Critical | Fix immediately, blocks deployment |
| **Medium** | High | Fix within sprint |
| **Low** | Medium | Fix in next sprint |
| **Informational** | Low | Review, no immediate action |

### Common Findings & Fixes

#### 1. SQL Injection

**Finding:**
```
SQL Injection found in parameter 'id'
URL: /api/horses/1' OR '1'='1
```

**Fix:**
```javascript
// ❌ BAD: String concatenation
const query = `SELECT * FROM horses WHERE id = ${id}`;

// ✅ GOOD: Parameterized query (Prisma)
const horse = await prisma.horse.findUnique({
  where: { id: parseInt(id) }
});
```

#### 2. XSS (Cross-Site Scripting)

**Finding:**
```
Reflected XSS in parameter 'name'
URL: /api/horses?name=<script>alert(1)</script>
```

**Fix:**
```javascript
// ❌ BAD: Direct output
res.send(`<h1>${name}</h1>`);

// ✅ GOOD: Sanitized output
const sanitizedName = escapeHtml(name);
res.json({ name: sanitizedName });
```

#### 3. Missing Security Headers

**Finding:**
```
X-Frame-Options header not set
X-Content-Type-Options header not set
Content-Security-Policy header not set
```

**Fix:**
```javascript
// middleware/security.mjs
app.use(helmet({
  frameguard: { action: 'deny' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    }
  },
  xContentTypeOptions: 'nosniff',
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### 4. Cookie Security Issues

**Finding:**
```
Cookie without Secure flag
Cookie without HttpOnly flag
Cookie without SameSite attribute
```

**Fix:**
```javascript
// ❌ BAD: Insecure cookie
res.cookie('accessToken', token);

// ✅ GOOD: Secure cookie
res.cookie('accessToken', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

#### 5. CSRF Token Missing

**Finding:**
```
Absence of Anti-CSRF Tokens
Endpoint: POST /api/horses
```

**Fix:**
```javascript
// middleware/csrf.mjs
import csrf from 'csurf';

const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
});

app.use(csrfProtection);

// Include CSRF token in responses
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});
```

---

## False Positives

### Common False Positives

1. **Path Traversal in REST APIs**
   - ZAP may flag `/api/horses/:id` as path traversal
   - **Resolution**: Add rule `10049 IGNORE` if validated

2. **CORS Misconfiguration**
   - ZAP may flag intentional CORS setup
   - **Resolution**: Document in `.github/zap-rules.tsv`

3. **Anti-CSRF Tokens**
   - ZAP may not recognize custom CSRF implementation
   - **Resolution**: Set threshold to `DEFAULT` instead of `HIGH`

### Handling False Positives

```tsv
# .github/zap-rules.tsv

# False positive: REST API uses :id parameters, not path traversal
10049	IGNORE		# Path Traversal (validated REST API)

# False positive: CORS intentionally configured for frontend
10098	IGNORE		# Cross-Domain Misconfiguration (CORS setup)

# Reduce noise: Custom CSRF implementation
10202	DEFAULT		# Anti-CSRF tokens (custom implementation)
```

---

## Troubleshooting

### Scan Timeout

**Issue:** Scan exceeds time limit

**Solution:**
```yaml
# Increase timeout in workflow
cmd_options: '-a -j -m 10 -T 60'
#                  ^^    ^^^
#                  |     Maximum time per spider (minutes)
#                  Maximum scan duration (minutes)
```

### False Negative (Missed Vulnerability)

**Issue:** Known vulnerability not detected

**Solution:**
1. Verify endpoint is in OpenAPI spec
2. Check authentication is configured
3. Increase scan threshold: `MEDIUM` → `LOW`
4. Run full scan (weekly schedule)

### Server Startup Failure

**Issue:** API server fails to start in CI

**Solution:**
```yaml
# Add wait-on step
- name: Start API server
  run: |
    npm start &
    npx wait-on http://localhost:3000/health -t 30000
```

### High Memory Usage

**Issue:** ZAP consumes excessive memory

**Solution:**
```yaml
# Limit spider scope
cmd_options: '-a -j -m 5 -z "-config spider.maxDepth=3"'
```

---

## Best Practices

### 1. Review Results Weekly

- Check GitHub Security tab
- Triage new findings
- Update rules for false positives
- Track remediation progress

### 2. Test Before Deployment

```bash
# Run local scan before push
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable \
  zap-baseline.py -t http://localhost:3000
```

### 3. Maintain OpenAPI Spec

- Keep Swagger docs up-to-date
- Document all endpoints
- Include authentication flows
- Add request/response examples

### 4. Configure CI/CD Thresholds

```yaml
# Block deployment on high-severity findings
fail_action: ${{ github.event_name == 'push' && 'true' || 'false' }}
```

### 5. Monitor Trends

- Track vulnerability count over time
- Identify recurring patterns
- Update rules based on findings
- Share findings with team

---

## Integration with Other Tools

### Sentry

ZAP findings can trigger Sentry alerts:

```javascript
// utils/securityMonitoring.mjs
import Sentry from '@sentry/node';

export function reportSecurityFinding(finding) {
  Sentry.captureMessage(`Security Issue: ${finding.name}`, {
    level: 'error',
    tags: {
      security: true,
      zap_scan: true,
      risk: finding.risk
    },
    extra: finding
  });
}
```

### Slack/Email Notifications

Configure GitHub Actions to send notifications:

```yaml
- name: Notify Security Team
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: '🚨 ZAP Scan found high-severity vulnerabilities'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Metrics & KPIs

Track security posture over time:

| Metric | Target | Current |
|--------|--------|---------|
| High-severity findings | 0 | TBD |
| Medium-severity findings | <5 | TBD |
| Mean time to remediation (MTTR) | <7 days | TBD |
| False positive rate | <10% | TBD |
| Scan coverage | 100% of endpoints | TBD |

---

## Resources

### Official Documentation
- [OWASP ZAP Website](https://www.zaproxy.org/)
- [ZAP User Guide](https://www.zaproxy.org/docs/)
- [ZAP GitHub Actions](https://github.com/zaproxy/action-baseline)

### OWASP Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

### Community
- [ZAP Community Forum](https://groups.google.com/g/zaproxy-users)
- [GitHub Discussions](https://github.com/zaproxy/zaproxy/discussions)
- [OWASP Slack](https://owasp.org/slack/invite)

---

## Changelog

| Date | Changes |
|------|---------|
| 2025-12-10 | Initial implementation (Story 7, Task 3) |
| TBD | First scan results and tuning |

---

**Maintained by:** Security Team
**Next Review:** 2025-12-17
