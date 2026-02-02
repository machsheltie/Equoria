# 12. Troubleshooting

### 12.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Database connection errors | Invalid DATABASE_URL | Check URL format and network |
| JWT errors | Missing/invalid secret | Verify JWT_SECRET is set |
| CORS errors | Origin not whitelisted | Check ALLOWED_ORIGINS |
| Memory issues | Memory leaks | Monitor heap, scale horizontally |
| Slow responses | Query optimization needed | Add indexes, optimize queries |

### 12.2 Debugging Commands

```bash
# View application logs
pm2 logs equoria-api

# Monitor performance
pm2 monit

# Check health status
curl http://localhost:3000/health

# Database connection test
npx prisma db execute --stdin < test-query.sql

# Check process status
pm2 status
```

### 12.3 Log Analysis

```bash
# View error logs
tail -f ./logs/err.log

# Search for specific errors
grep -i "error" ./logs/combined.log | tail -100

# Count error types
grep -i "error" ./logs/combined.log | sort | uniq -c | sort -rn
```

---
