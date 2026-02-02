# 9. Rollback Procedures

### 9.1 Immediate Rollback

```bash
# Stop new deployment
docker stop equoria-prod-green

# Start previous version
docker start equoria-prod-blue

# Update load balancer to point to blue

# Verify rollback
curl -f http://localhost:3000/health
```

### 9.2 Database Rollback

```bash
# Check migration status
npx prisma migrate status

# Rollback to specific migration
npx prisma migrate resolve --rolled-back "migration_name"

# Reset to last known good state (DANGER: Data loss)
# Only use in emergency with backups
npx prisma migrate reset
```

### 9.3 Emergency Contacts

| Role | Contact Method |
|------|----------------|
| Development Team Lead | Primary on-call |
| DevOps Engineer | Secondary on-call |
| Technical Director | Escalation |
| Slack Channel | #equoria-deployments |

---
