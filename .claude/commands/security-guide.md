# Security Guide

**Skill:** `/security-guide`
**Purpose:** Load comprehensive security documentation when working on auth, validation, or security features

---

## When to Use This Skill

Invoke this skill when:

- Working on authentication endpoints
- Implementing JWT token logic
- Adding rate limiting or anti-automation
- Reviewing security vulnerabilities
- Conducting security audits

---

## Security Documentation

See `.claude/rules/SECURITY.md` for:

- Authentication & Authorization patterns
- Game integrity protection (stat manipulation prevention)
- Input validation & sanitization
- Rate limiting configuration
- Audit logging setup
- Common exploit prevention

---

## Quick Security Checklist

✅ **Before Committing Security Code:**

- [ ] Input validation on all user inputs
- [ ] JWT tokens properly verified
- [ ] Rate limiting on sensitive endpoints
- [ ] Ownership checks on protected resources
- [ ] Audit logging for high-sensitivity operations
- [ ] Protected stats cannot be directly modified

---

**Load full documentation:**

```bash
cat .claude/rules/SECURITY.md
```
