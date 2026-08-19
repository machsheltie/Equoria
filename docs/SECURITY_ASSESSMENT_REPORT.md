# Retired Security Assessment — Compatibility Stub

The dated security assessment was retired to `docs/.archive/retired-2026-08-19/docs-root/SECURITY_ASSESSMENT_REPORT.md`. Its historical coverage totals, findings, statuses, and recommendations must not be treated as current security posture.

This path remains only because a legacy documentation-drift sentinel reads it. Current authority is `.claude/rules/SECURITY.md`, live middleware/configuration, current security tests, `docs/SECURITY_TESTING.md`, executable doctrine gates, and current issue state.

Compatibility fact enforced elsewhere: the shared auth rate limiter allows **200 failed** authentication attempts per 15-minute window and does not count successful requests. The implementation and its sentinel own that value.
