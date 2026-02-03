Load Tests (k6)

These scripts are k6 load tests. They are not Jest tests and are excluded
from Jest discovery.

Run with k6:
  k6 run backend/tests/load/rate-limiting.test.js
  k6 run backend/tests/load/distributed-rate-limiting.test.js
  k6 run backend/tests/load/concurrent-sessions.test.js
  k6 run backend/tests/load/auth-under-load.test.js
