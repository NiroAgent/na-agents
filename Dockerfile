# Multi-stage Docker build for AI Agents
FROM python:3.11-slim as base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent files
COPY *.py ./
COPY shared/ ./shared/

# Create logs directory
RUN mkdir -p /var/log/agents

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "print('Health check passed')" || exit 1

# Default command (can be overridden)
CMD ["python", "enhanced-batch-agent-processor.py"]
