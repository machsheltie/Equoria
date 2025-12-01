# 🚀 Equoria Production Deployment Guide

## 📋 Pre-Deployment Checklist

### **Environment Configuration**
- [ ] Set `NODE_ENV=production`
- [ ] Generate secure `JWT_SECRET` (64+ characters)
- [ ] Configure production database URL
- [ ] Set up CORS allowed origins
- [ ] Configure logging level
- [ ] Set up SSL certificates

### **Security Checklist**
- [ ] JWT secret is cryptographically secure
- [ ] Database credentials are secure
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] Security headers are configured
- [ ] Input validation is in place

### **Database Setup**
- [ ] Production database is created
- [ ] Database migrations are applied
- [ ] Database user has minimal required permissions
- [ ] Database backups are configured
- [ ] Connection pooling is configured

## 🔧 Environment Variables

Create a `.env` file with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL="postgres://username:password@host:port/database"

# JWT Authentication
JWT_SECRET="your-cryptographically-secure-secret-here"

# CORS Configuration
ALLOWED_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"

# Optional: Advanced Configuration
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_SALT_ROUNDS=12
```

## 🐳 Docker Deployment

### **Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
```

### **docker-compose.yml**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgres://user:pass@db:5432/equoria
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=equoria
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

## ☁️ Cloud Deployment Options

### **Heroku**
```bash
# Install Heroku CLI
npm install -g heroku

# Login and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET="your-secret"
heroku config:set DATABASE_URL="your-db-url"

# Deploy
git push heroku main
```

### **Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### **DigitalOcean App Platform**
```yaml
name: equoria-api
services:
- name: api
  source_dir: /
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
```

## 🔍 Health Monitoring

### **Health Check Endpoints**
- `GET /ping` - Basic ping/pong
- `GET /health` - Comprehensive health check with database status

### **Monitoring Setup**
```bash
# Example health check script
#!/bin/bash
response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
if [ $response != "200" ]; then
  echo "Health check failed with status: $response"
  exit 1
fi
echo "Health check passed"
```

## 🔒 Security Hardening

### **Reverse Proxy (Nginx)**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **Process Management (PM2)**
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'equoria-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
EOF

# Start application
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 📊 Performance Optimization

### **Database Optimization**
- Enable connection pooling
- Add database indexes
- Configure query timeout
- Set up read replicas if needed

### **Application Optimization**
- Enable gzip compression
- Set up CDN for static assets
- Configure caching headers
- Monitor memory usage

## 🔄 CI/CD Pipeline

### **GitHub Actions Example**
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        run: |
          # Your deployment script here
```

## 🚨 Troubleshooting

### **Common Issues**
1. **Database Connection Errors**: Check DATABASE_URL and network connectivity
2. **JWT Errors**: Verify JWT_SECRET is set and consistent
3. **CORS Errors**: Check ALLOWED_ORIGINS configuration
4. **Memory Issues**: Monitor heap usage and consider scaling

### **Logs and Debugging**
```bash
# View application logs
pm2 logs equoria-api

# Monitor performance
pm2 monit

# Check health status
curl http://localhost:3000/health
```

## 📞 Support

For deployment issues, check:
1. Application logs
2. Database connectivity
3. Environment variables
4. Health check endpoints
5. Security configurations

Remember to test your deployment in a staging environment before going to production!
