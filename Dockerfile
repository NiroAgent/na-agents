# Multi-stage Docker build for TypeScript AI Agents
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine as production

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S agents -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=agents:nodejs /app/dist ./dist
COPY --from=builder --chown=agents:nodejs /app/node_modules ./node_modules
COPY --chown=agents:nodejs package*.json ./

# Create necessary directories
RUN mkdir -p logs && \
    mkdir -p architecture_specs && \
    mkdir -p qa_reports && \
    mkdir -p generated_code && \
    chown -R agents:nodejs logs architecture_specs qa_reports generated_code

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV DASHBOARD_URL=http://localhost:4001

# Expose ports for all agents
EXPOSE 5001 5002 5003 5004 5005

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Switch to non-root user
USER agents

# Default command (start all agents)
CMD ["node", "dist/index.js"]
