# Edge Case Hunter Review Prompt

Use skill: `bmad-review-edge-case-hunter`

Role:
- You are the Edge Case Hunter.
- Review this diff with read-only access to the project.
- Explore surrounding code when needed.

Output format:
- Markdown list only.
- Each finding must include:
  - short title
  - severity (`P0`, `P1`, `P2`, or `P3`)
  - file reference
  - exact edge case or failure mode
  - why it matters

Focus on:
- boundary conditions
- broken CI assumptions
- false-positive gates
- environmental drift
- weak readiness evidence
- regressions introduced by security hardening

Additional project context:
- Beta readiness must be real, no bypasses, no mock primary paths, no graceful skips.
- Recent hardening areas include CI gates and parser-layer request-body security.

Diff to review:

```diff
diff --git a/.github/workflows/ci-cd.yml b/.github/workflows/ci-cd.yml
index 367d742d..dce91a53 100644
--- a/.github/workflows/ci-cd.yml
+++ b/.github/workflows/ci-cd.yml
@@ -401,11 +401,31 @@ jobs:
             ./frontend/build/
           retention-days: 7
 
-  # Job 8: Security Scanning
-  security-scan:
-    name: 'Security Scanning'
+  # Job 8: Security Gate (blocking)
+  #
+  # Align with test.yml:
+  # - Environment validation is blocking
+  # - Backend security suite is blocking
+  # - Dependency audit is blocking at high severity
+  security-gate:
+    name: 'Security Gate'
     runs-on: ubuntu-latest
-    needs: [code-quality]
+    needs: [code-quality, database-setup]
+
+    services:
+      postgres:
+        image: postgres:15
+        env:
+          POSTGRES_USER: test
+          POSTGRES_PASSWORD: test
+          POSTGRES_DB: equoria_test
+        options: >-
+          --health-cmd pg_isready
+          --health-interval 10s
+          --health-timeout 5s
+          --health-retries 5
+        ports:
+          - 5432:5432
 
     steps:
       - name: 'Checkout Repository'
@@ -419,6 +439,7 @@ jobs:
           cache-dependency-path: |
             backend/package-lock.json
             frontend/package-lock.json
+            packages/database/package-lock.json
 
       - name: 'Install Backend Dependencies'
         working-directory: ./backend
@@ -428,29 +449,58 @@ jobs:
         working-directory: ./frontend
         run: npm ci
 
+      - name: 'Install Database Dependencies'
+        working-directory: ./packages/database
+        run: npm ci
+
+      - name: 'Generate Prisma Client + Run Migrations'
+        working-directory: ./packages/database
+        run: |
+          npx prisma generate --schema=prisma/schema.prisma
+          npx prisma migrate deploy --schema=prisma/schema.prisma
+
+      - name: 'Validate Environment Policy'
+        working-directory: ./backend
+        run: npm run validate-env
+
+      - name: 'Run Backend Security Suite'
+        working-directory: ./backend
+        run: npm run test:security
+
       - name: 'Run Security Audit (Backend)'
         working-directory: ./backend
-        run: npm audit --audit-level=moderate
+        run: npm audit --audit-level=high
 
       - name: 'Run Security Audit (Frontend)'
         working-directory: ./frontend
-        run: npm audit --audit-level=moderate
+        run: npm audit --audit-level=high
 
-  # Job 9: Static Beta-Parity Checks (NOT a beta-readiness signoff)
+  # Job 9: Beta Readiness Gate (master only)
   #
-  # This job runs the static-only portion of the beta-parity gates (mock scan,
-  # bypass-header scan, skip scan, HTTP cleanup-route scan). It is NOT a
-  # beta-readiness signoff. Beta signoff requires the full
-  # scripts/check-beta-readiness.sh run (including Playwright E2E against a
-  # live backend + frontend + PostgreSQL). That run must be performed on an
-  # environment that can host all three services; this CI job intentionally
-  # does not attempt it and therefore cannot be cited as readiness evidence.
-  static-beta-parity-checks:
-    name: 'Static Beta-Parity Checks (not signoff)'
+  # CI-runnable production-parity readiness lane:
+  # - static scans (cleanup routes, DB mocks, frontend mocks, bypass headers)
+  # - full Playwright readiness suite against live backend + frontend + Postgres
+  beta-readiness-gate:
+    name: 'Beta Readiness Gate'
     runs-on: ubuntu-latest
-    needs: [build-validation, security-scan, performance-tests]
+    needs: [build-validation, security-gate, performance-tests]
     if: github.ref == 'refs/heads/master'
 
+    services:
+      postgres:
+        image: postgres:15
+        env:
+          POSTGRES_USER: test
+          POSTGRES_PASSWORD: test
+          POSTGRES_DB: equoria_test
+        options: >-
+          --health-cmd pg_isready
+          --health-interval 10s
+          --health-timeout 5s
+          --health-retries 5
+        ports:
+          - 5432:5432
+
     steps:
       - name: 'Checkout Repository'
         uses: actions/checkout@v4
@@ -458,11 +508,37 @@ jobs:
       - name: 'Setup Node.js'
         uses: actions/setup-node@v4
         with:
-          node-version: '20'
+          node-version: ${{ env.NODE_VERSION }}
           cache: 'npm'
+          cache-dependency-path: |
+            package-lock.json
+            backend/package-lock.json
+            frontend/package-lock.json
+            packages/database/package-lock.json
+
+      - name: 'Cache Playwright Browsers'
+        uses: actions/cache@v4
+        with:
+          path: ~/.cache/ms-playwright
+          key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
+          restore-keys: |
+            ${{ runner.os }}-playwright-
 
       - name: 'Install Dependencies'
-        run: npm ci
+        run: |
+          npm ci
+          cd backend && npm ci
+          cd ../frontend && npm ci
+          cd ../packages/database && npm ci
+
+      - name: 'Setup Database'
+        working-directory: ./packages/database
+        run: |
+          npx prisma generate --schema=prisma/schema.prisma
+          npx prisma migrate deploy --schema=prisma/schema.prisma
+
+      - name: 'Install Playwright Browsers'
+        run: npx playwright install --with-deps chromium
 
       - name: 'Scan for test/cleanup routes in HTTP layer'
         run: |
@@ -504,23 +580,33 @@ jobs:
             exit 1
           fi
 
-      - name: 'Create Static-Parity Summary (NOT readiness signoff)'
+      - name: 'Run Beta Readiness Playwright Suite'
+        run: npm run test:e2e:beta-readiness
+
+      - name: 'Upload Beta Readiness Artifacts'
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: beta-readiness-artifacts
+          path: |
+            playwright-report/beta-readiness/
+            test-results/beta-readiness/
+          retention-days: 14
+
+      - name: 'Create Beta Readiness Summary'
         if: always()
         run: |
-          echo "## Static Beta-Parity Checks" >> $GITHUB_STEP_SUMMARY
+          echo "## Beta Readiness Gate" >> $GITHUB_STEP_SUMMARY
           echo "- **Branch**: ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
           echo "- **Commit**: ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
-          echo "- **Scope**: static scans only (mocks, bypass headers, cleanup routes)" >> $GITHUB_STEP_SUMMARY
-          echo "- **Not included**: lint, typecheck, backend tests, E2E readiness suite" >> $GITHUB_STEP_SUMMARY
-          echo "- **This job does NOT produce beta-readiness signoff.**" >> $GITHUB_STEP_SUMMARY
-          echo "  Run \`bash scripts/check-beta-readiness.sh\` locally with a live" >> $GITHUB_STEP_SUMMARY
-          echo "  backend + frontend + PostgreSQL to perform full signoff." >> $GITHUB_STEP_SUMMARY
+          echo "- **Scope**: static parity scans + full Playwright readiness suite" >> $GITHUB_STEP_SUMMARY
+          echo "- **Evidence**: artifacts under \`beta-readiness-artifacts\`" >> $GITHUB_STEP_SUMMARY
 
   # Job 10: Docker Image Build Validation (master only)
   build-docker:
     name: 'Docker Build Validation'
     runs-on: ubuntu-latest
-    needs: [build-validation]
+    needs: [build-validation, security-gate, beta-readiness-gate]
     if: github.ref == 'refs/heads/master'
 
     steps:
diff --git a/.github/workflows/test.yml b/.github/workflows/test.yml
index 927e7780..225e7177 100644
--- a/.github/workflows/test.yml
+++ b/.github/workflows/test.yml
@@ -523,13 +523,33 @@ jobs:
           retention-days: 30
 
   # ──────────────────────────────────────────────────────────────────────────────
-  # JOB 8 — Security Audit (npm audit)
+  # JOB 8 — Security Gate (blocking)
+  #
+  # P0 hardening policy:
+  # - Dependency audit is blocking at high severity
+  # - Backend security suite is blocking
+  # - Environment validation is blocking
   # ──────────────────────────────────────────────────────────────────────────────
-  security-audit:
-    name: 'Dependency Security Audit'
+  security-gate:
+    name: 'Security Gate'
     runs-on: ubuntu-latest
-    timeout-minutes: 5
-    needs: [lint]
+    timeout-minutes: 20
+    needs: [lint, db-preflight]
+
+    services:
+      postgres:
+        image: postgres:15
+        env:
+          POSTGRES_USER: test
+          POSTGRES_PASSWORD: test
+          POSTGRES_DB: equoria_test
+        options: >-
+          --health-cmd pg_isready
+          --health-interval 10s
+          --health-timeout 5s
+          --health-retries 5
+        ports:
+          - 5432:5432
 
     steps:
       - uses: actions/checkout@v4
@@ -542,6 +562,7 @@ jobs:
           cache-dependency-path: |
             backend/package-lock.json
             frontend/package-lock.json
+            packages/database/package-lock.json
 
       - name: Install backend dependencies
         working-directory: ./backend
@@ -551,15 +572,31 @@ jobs:
         working-directory: ./frontend
         run: npm ci
 
+      - name: Install database dependencies
+        working-directory: ./packages/database
+        run: npm ci
+
+      - name: Generate Prisma client + run migrations
+        working-directory: ./packages/database
+        run: |
+          npx prisma generate --schema=prisma/schema.prisma
+          npx prisma migrate deploy --schema=prisma/schema.prisma
+
+      - name: Validate environment policy
+        working-directory: ./backend
+        run: npm run validate-env
+
+      - name: Run backend security suite
+        working-directory: ./backend
+        run: npm run test:security
+
       - name: npm audit — backend
         working-directory: ./backend
         run: npm audit --audit-level=high
-        continue-on-error: true # Report but don't block — upgrade separately
 
       - name: npm audit — frontend
         working-directory: ./frontend
         run: npm audit --audit-level=high
-        continue-on-error: true
 
   # ──────────────────────────────────────────────────────────────────────────────
   # JOB 9 — Docker Build Validation (master only)
@@ -614,15 +651,137 @@ jobs:
               done; \
               echo 'Frontend shell and required image assets embedded'"
 
+  # ──────────────────────────────────────────────────────────────────────────────
+  # JOB 9.5 — Beta Readiness Gate (master only)
+  #
+  # CI-runnable production-parity readiness lane:
+  # - static scans (cleanup routes, DB mocks, frontend mocks, bypass headers)
+  # - full Playwright readiness suite against live backend + frontend + Postgres
+  # This replaces the old "local-only signoff" assumption with reproducible CI
+  # evidence for beta readiness.
+  # ──────────────────────────────────────────────────────────────────────────────
+  beta-readiness-gate:
+    name: 'Beta Readiness Gate'
+    runs-on: ubuntu-latest
+    timeout-minutes: 35
+    needs: [coverage-gate, security-gate, frontend-tests]
+    if: github.ref == 'refs/heads/master'
+
+    services:
+      postgres:
+        image: postgres:15
+        env:
+          POSTGRES_USER: test
+          POSTGRES_PASSWORD: test
+          POSTGRES_DB: equoria_test
+        options: >-
+          --health-cmd pg_isready
+          --health-interval 10s
+          --health-timeout 5s
+          --health-retries 5
+        ports:
+          - 5432:5432
+
+    steps:
+      - uses: actions/checkout@v4
+
+      - name: Setup Node.js
+        uses: actions/setup-node@v4
+        with:
+          node-version: ${{ env.NODE_VERSION }}
+          cache: 'npm'
+          cache-dependency-path: |
+            package-lock.json
+            backend/package-lock.json
+            frontend/package-lock.json
+            packages/database/package-lock.json
+
+      - name: Cache Playwright browsers
+        uses: actions/cache@v4
+        with:
+          path: ~/.cache/ms-playwright
+          key: ${{ runner.os }}-playwright-${{ hashFiles('**/package-lock.json') }}
+          restore-keys: |
+            ${{ runner.os }}-playwright-
+
+      - name: Install all dependencies
+        run: |
+          npm ci
+          cd backend && npm ci
+          cd ../frontend && npm ci
+          cd ../packages/database && npm ci
+
+      - name: Setup database
+        working-directory: ./packages/database
+        run: |
+          npx prisma generate --schema=prisma/schema.prisma
+          npx prisma migrate deploy --schema=prisma/schema.prisma
+
+      - name: Install Playwright browsers
+        run: npx playwright install --with-deps chromium
+
+      - name: Scan for test/cleanup routes in HTTP layer
+        run: |
+          if grep -rn "test/cleanup\|testCleanup\|test-cleanup" \
+              backend/modules/*/routes/ \
+              backend/routes/ \
+              2>/dev/null | grep -v "^Binary" | grep -q .; then
+            echo "FAIL: HTTP test-cleanup routes found"
+            exit 1
+          fi
+
+      - name: Scan integration tests for DB mocks
+        run: |
+          if grep -rn \
+              "jest\.unstable_mockModule.*prisma\|jest\.unstable_mockModule.*db/\|jest\.mock.*prisma\|jest\.mock.*db/" \
+              backend/tests/integration/ \
+              2>/dev/null | grep -v "^Binary" | grep -q .; then
+            echo "FAIL: DB mocks found in integration tests"
+            exit 1
+          fi
+
+      - name: Scan frontend production code for mock data
+        run: |
+          if grep -rn "mockApi\|MOCK_\|allMockHorses\|mockSummary" \
+              frontend/src/ \
+              --include="*.tsx" --include="*.ts" \
+              2>/dev/null | grep -v "__tests__\|\.test\.\|\.spec\." | grep -v "^Binary" | grep -q .; then
+            echo "FAIL: Mock data in frontend production code"
+            exit 1
+          fi
+
+      - name: Scan E2E specs and api-client for bypass headers
+        run: |
+          if grep -rn "x-test-bypass-rate-limit\|x-test-skip-csrf\|bypass-auth\|x-test-user\|x-bypass\|VITE_E2E_TEST" \
+              tests/e2e/ frontend/src/lib/api-client.ts \
+              --exclude-dir=readiness \
+              2>/dev/null | grep -v "^Binary" | grep -q .; then
+            echo "FAIL: Bypass headers in E2E/api-client"
+            exit 1
+          fi
+
+      - name: Run beta-readiness Playwright suite
+        run: npm run test:e2e:beta-readiness
+
+      - name: Upload beta-readiness artifacts
+        if: always()
+        uses: actions/upload-artifact@v4
+        with:
+          name: beta-readiness-artifacts
+          path: |
+            playwright-report/beta-readiness/
+            test-results/beta-readiness/
+          retention-days: 14
+
   # ──────────────────────────────────────────────────────────────────────────────
   # JOB 10 — Deployment Gate (master only)
-  # Blocks on: coverage-gate, e2e-tests, docker-build
-  # Does NOT block on: performance-tests, security-audit (both advisory)
+  # Blocks on: coverage-gate, security-gate, beta-readiness-gate, e2e-tests, docker-build
+  # Does NOT block on: performance-tests
   # ──────────────────────────────────────────────────────────────────────────────
   deployment-gate:
     name: 'Deployment Gate'
     runs-on: ubuntu-latest
-    needs: [coverage-gate, e2e-tests, docker-build]
+    needs: [coverage-gate, security-gate, beta-readiness-gate, e2e-tests, docker-build]
     if: github.ref == 'refs/heads/master'
 
     steps:
@@ -636,6 +795,8 @@ jobs:
           echo "| DB Migration | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
           echo "| Backend Tests (3 shards) | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
           echo "| Coverage ≥ 70% | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
+          echo "| Security Gate | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
+          echo "| Beta Readiness Gate | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
           echo "| Frontend Tests | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
           echo "| E2E Tests | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
           echo "| Docker Build | ✅ Passed |" >> $GITHUB_STEP_SUMMARY
@@ -643,7 +804,7 @@ jobs:
           echo "**Commit:** ${{ github.sha }}" >> $GITHUB_STEP_SUMMARY
           echo "**Branch:** ${{ github.ref_name }}" >> $GITHUB_STEP_SUMMARY
           echo "" >> $GITHUB_STEP_SUMMARY
-          echo "_Advisory (non-blocking): Performance tests, Security audit_" >> $GITHUB_STEP_SUMMARY
+          echo "_Advisory (non-blocking): Performance tests_" >> $GITHUB_STEP_SUMMARY
           echo "🚀 Ready for Railway deployment"
 
   # ──────────────────────────────────────────────────────────────────────────────
diff --git a/backend/__tests__/integration/security/parameter-pollution.test.mjs b/backend/__tests__/integration/security/parameter-pollution.test.mjs
index 8387e183..79df09b6 100644
--- a/backend/__tests__/integration/security/parameter-pollution.test.mjs
+++ b/backend/__tests__/integration/security/parameter-pollution.test.mjs
@@ -151,12 +151,7 @@ describe('Parameter Pollution Attack Integration Tests', () => {
   });
 
   describe('JSON Parameter Pollution', () => {
-    it.skip('TODO: reject duplicate keys in JSON payload (app currently accepts last-value wins)', async () => {
-      // Express's built-in body parser silently takes the last value when a
-      // JSON body contains duplicate keys, and the horse update endpoint
-      // does not reject this. This test documents a missing defense —
-      // skipped until a dedicated duplicate-key detector is added to the
-      // request pipeline. Not in scope for the CSRF correction.
+    it('should reject duplicate keys in JSON payload', async () => {
       const maliciousPayload = '{"name":"ValidName","name":"HackedName"}';
 
       const response = await request(app)
@@ -189,21 +184,15 @@ describe('Parameter Pollution Attack Integration Tests', () => {
       expect(response.body.success).toBe(false);
     });
 
-    it.skip('TODO: reject prototype pollution attempts at the request-body layer', async () => {
-      // A dedicated prototype-pollution detector at the body-parser layer
-      // would reject any body with `__proto__` / `constructor.prototype`
-      // keys before reaching the handler. Not implemented yet — skipped.
-      // Not in scope for the CSRF correction.
+    it('should reject prototype pollution attempts at the request-body layer', async () => {
       const response = await request(app)
         .put(`/api/horses/${testHorse.id}`)
         .set('Authorization', `Bearer ${validToken}`)
         .set('Origin', 'http://localhost:3000')
         .set('Cookie', __csrf__.cookieHeader)
         .set('X-CSRF-Token', __csrf__.csrfToken)
-        .send({
-          name: 'ValidName',
-          __proto__: { isAdmin: true },
-        })
+        .set('Content-Type', 'application/json')
+        .send('{"name":"ValidName","__proto__":{"isAdmin":true}}')
         .expect(400);
       expect(response.body.success).toBe(false);
       expect(testUser.isAdmin).toBeUndefined();
diff --git a/backend/app.mjs b/backend/app.mjs
index 8155ce0d..33d6454d 100644
--- a/backend/app.mjs
+++ b/backend/app.mjs
@@ -133,6 +133,11 @@ import { authenticateToken, requireRole } from './middleware/auth.mjs';
 
 // Import CSRF protection middleware
 import { csrfProtection, csrfErrorHandler } from './middleware/csrf.mjs';
+import {
+  verifyJsonBody,
+  rejectPollutedRequestBody,
+  requestBodySecurityErrorHandler,
+} from './middleware/requestBodySecurity.mjs';
 
 // Import Redis rate limiting (for health check and shutdown)
 import { createRateLimiter, isRedisConnected, getRedisClient } from './middleware/rateLimiting.mjs';
@@ -440,8 +445,9 @@ const apiLimiter = createRateLimiter({
 app.use('/api/', apiLimiter);
 
 // Body parsing middleware
-app.use(express.json({ limit: '10mb' }));
+app.use(express.json({ limit: '10mb', verify: verifyJsonBody }));
 app.use(express.urlencoded({ extended: true, limit: '10mb' }));
+app.use(rejectPollutedRequestBody);
 
 // Cookie parsing middleware for httpOnly cookies
 app.use(cookieParser());
@@ -691,6 +697,7 @@ attachSentryErrorHandler(app);
 
 // CSRF error handler (must be before global error handler)
 app.use(csrfErrorHandler);
+app.use(requestBodySecurityErrorHandler);
 
 // Global error handler
 app.use(errorHandler);
```
