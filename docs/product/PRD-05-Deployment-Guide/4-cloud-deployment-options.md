# 4. Cloud Deployment Options

### 4.1 Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET="your-secret"
heroku config:set JWT_REFRESH_SECRET="your-refresh-secret"
heroku config:set DATABASE_URL="your-db-url"

# Deploy
git push heroku main

# Run migrations
heroku run npx prisma migrate deploy
```

### 4.2 Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up

# Set environment variables via Railway dashboard
```

### 4.3 DigitalOcean App Platform

```yaml
name: equoria-api
services:
- name: api
  source_dir: /backend
  github:
    repo: your-username/equoria
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: NODE_ENV
    value: production
  - key: JWT_SECRET
    value: your-secret
    type: SECRET
  - key: DATABASE_URL
    value: your-db-url
    type: SECRET
```

### 4.4 AWS Elastic Beanstalk

```yaml
# .elasticbeanstalk/config.yml
branch-defaults:
  main:
    environment: equoria-production

deploy:
  artifact: deploy.zip

environment-defaults:
  equoria-production:
    branch: null
    repository: null

global:
  application_name: equoria
  default_ec2_keyname: your-key
  default_platform: Node.js 18
  default_region: us-east-1
```

---
