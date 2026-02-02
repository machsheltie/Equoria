# 7. Health Monitoring

### 7.1 Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /ping` | Basic ping/pong | 200 OK |
| `GET /health` | Comprehensive health check | 200 with status JSON |

### 7.2 Health Check Script

```bash
#!/bin/bash
# health-check.sh

echo "Running Health Checks..."

# Basic server health
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response != "200" ]; then
  echo "Health check failed with status: $response"
  exit 1
fi

# API endpoint verification
curl -f http://localhost:3000/api || exit 1

# Database connectivity (via health endpoint)
health_data=$(curl -s http://localhost:3000/health)
db_status=$(echo $health_data | jq -r '.database')
if [ "$db_status" != "connected" ]; then
  echo "Database health check failed"
  exit 1
fi

echo "All health checks passed!"
```

### 7.3 Key Metrics to Monitor

**API Performance:**
- Response times (p50, p95, p99)
- Request throughput
- Error rates (4xx, 5xx)
- Active connections

**Database Performance:**
- Query execution times
- Connection pool utilization
- Lock contention
- Disk usage

**System Resources:**
- CPU utilization
- Memory usage
- Disk I/O
- Network bandwidth

### 7.4 Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Response time | >1 second | >2 seconds |
| Error rate | >2% | >5% |
| CPU usage | >70% | >90% |
| Memory usage | >70% | >85% |
| Disk usage | >70% | >85% |
| DB connections | >70% pool | >90% pool |

---
