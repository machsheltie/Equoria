# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files for better caching
COPY backend/package*.json ./backend/
COPY packages/database/package*.json ./packages/database/

# Install dependencies
WORKDIR /app/backend
RUN npm ci --only=production

WORKDIR /app/packages/database
RUN npm ci --only=production

# Copy application code
WORKDIR /app
COPY . .

# Generate Prisma client
WORKDIR /app/packages/database
RUN npx prisma generate

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory back to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
