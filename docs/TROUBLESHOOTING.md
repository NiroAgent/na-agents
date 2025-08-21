# 🔧 NA-Agents Troubleshooting Guide

## Overview

Comprehensive troubleshooting guide for the NA-Agents multi-agent system, covering common issues, diagnostic procedures, and resolution steps.

## Quick Diagnostics

### System Health Check
```bash
# Check all agent health endpoints
for port in 5001 5002 5003 5004 5005; do
  echo "Testing Agent on port $port:"
  curl -s -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:$port/health | jq '.status'
done

# Check chat interface
echo "Testing Chat Interface:"
curl -s https://dev.agents.visualforge.ai:7000/health | jq '.status'

# Check GitHub service
echo "Testing GitHub Service:"
curl -s https://dev.agents.visualforge.ai:6000/health | jq '.status'
```

### DNS Resolution Check
```bash
# Check DNS resolution
nslookup dev.agents.visualforge.ai
dig dev.agents.visualforge.ai

# Check SSL certificate
openssl s_client -connect dev.agents.visualforge.ai:443 -servername dev.agents.visualforge.ai
```

### Network Connectivity
```bash
# Test basic connectivity
telnet dev.agents.visualforge.ai 5001
telnet dev.agents.visualforge.ai 443

# Test with timeout
timeout 5 bash -c 'cat < /dev/null > /dev/tcp/dev.agents.visualforge.ai/5001'
echo $?  # 0 = success, 124 = timeout
```

## Common Issues

### 1. Agent Not Responding

#### Symptoms
- HTTP 503 Service Unavailable
- Connection timeout
- No response from health check

#### Diagnostic Steps
```bash
# Check agent process status
docker ps | grep na-agents
docker logs na-agents-architect

# Check resource usage
docker stats na-agents-architect

# Check agent-specific logs
tail -f logs/architect-agent.log
```

#### Common Causes & Solutions

**High CPU/Memory Usage**
```bash
# Check resource limits
docker inspect na-agents-architect | jq '.[0].HostConfig.Memory'

# Increase memory limit
docker update --memory=1g na-agents-architect

# Restart with more resources
docker-compose down
docker-compose up -d --scale architect-agent=1
```

**Process Crashed**
```bash
# Check exit code
docker inspect na-agents-architect | jq '.[0].State.ExitCode'

# Restart the container
docker restart na-agents-architect

# Check for core dumps
find /var/lib/docker -name "core.*" -type f
```

**Port Conflicts**
```bash
# Check port usage
netstat -tulpn | grep :5001
lsof -i :5001

# Kill conflicting process
sudo kill $(lsof -t -i:5001)

# Restart with different port
docker run -p 5002:5001 na-agents:latest
```

### 2. Authentication Failures

#### Symptoms
- HTTP 401 Unauthorized
- "Invalid API key" errors
- "Missing API key" errors

#### Diagnostic Steps
```bash
# Test with known good API key
curl -H "X-API-Key: dev-api-key-12345" https://dev.agents.visualforge.ai:5001/health

# Check API key format
echo $API_KEY | wc -c  # Should be reasonable length
echo $API_KEY | grep -E '^[a-zA-Z0-9-]+$'  # Should contain valid characters

# Test different endpoints
curl -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/status
```

#### Solutions

**Invalid API Key**
```bash
# Verify environment variable
echo "API Key: $API_KEY"

# Check for hidden characters
echo "$API_KEY" | hexdump -C

# Get fresh API key from secrets
aws secretsmanager get-secret-value --secret-id na-agents/api-key/dev --query SecretString --output text

# Update environment
export API_KEY="correct-api-key-here"
```

**Missing API Key Header**
```bash
# Correct request format
curl -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" https://dev.agents.visualforge.ai:5001/health

# Check case sensitivity (must be exact)
# ✅ Correct: X-API-Key
# ❌ Wrong: x-api-key, X-Api-Key
```

### 3. DNS Resolution Issues

#### Symptoms
- "Name or service not known"
- Connection timeouts
- Certificate errors

#### Diagnostic Steps
```bash
# Check DNS servers
cat /etc/resolv.conf

# Test different DNS servers
nslookup dev.agents.visualforge.ai 8.8.8.8
nslookup dev.agents.visualforge.ai 1.1.1.1

# Check DNS propagation
dig dev.agents.visualforge.ai +trace
```

#### Solutions

**DNS Not Propagated**
```bash
# Wait for propagation (usually 5-15 minutes)
# Check propagation status
dig dev.agents.visualforge.ai @8.8.8.8
dig dev.agents.visualforge.ai @1.1.1.1

# Force DNS refresh
sudo systemctl flush-dns  # Linux
sudo dscacheutil -flushcache  # macOS
ipconfig /flushdns  # Windows
```

**Local DNS Cache Issues**
```bash
# Add to /etc/hosts temporarily
echo "52.87.123.456 dev.agents.visualforge.ai" | sudo tee -a /etc/hosts

# Test with IP directly
curl -H "Host: dev.agents.visualforge.ai" https://52.87.123.456:5001/health
```

### 4. SSL/TLS Certificate Issues

#### Symptoms
- "Certificate verification failed"
- "SSL handshake failed"
- Browser security warnings

#### Diagnostic Steps
```bash
# Check certificate details
openssl s_client -connect dev.agents.visualforge.ai:443 -servername dev.agents.visualforge.ai | openssl x509 -noout -text

# Check certificate chain
curl -vI https://dev.agents.visualforge.ai

# Test with different TLS versions
openssl s_client -tls1_2 -connect dev.agents.visualforge.ai:443
openssl s_client -tls1_3 -connect dev.agents.visualforge.ai:443
```

#### Solutions

**Certificate Not Yet Valid/Expired**
```bash
# Check certificate validity
openssl s_client -connect dev.agents.visualforge.ai:443 2>/dev/null | openssl x509 -noout -dates

# Force certificate renewal (if ACM)
aws acm describe-certificate --certificate-arn arn:aws:acm:region:account:certificate/id

# Update CloudFormation if needed
aws cloudformation update-stack --stack-name na-agents-dns --template-body file://infrastructure/agents-dns-records.yml
```

**Self-Signed Certificate in Local Development**
```bash
# Accept self-signed certificates (development only)
curl -k https://dev.agents.visualforge.ai:5001/health

# Add CA certificate to trust store
sudo cp ca-certificate.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

### 5. High Latency/Performance Issues

#### Symptoms
- Slow response times (>2 seconds)
- Timeouts on large requests
- High CPU/memory usage

#### Diagnostic Steps
```bash
# Measure response times
curl -w "@curl-format.txt" -s -o /dev/null https://dev.agents.visualforge.ai:5001/health

# Check agent resource usage
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# Monitor request patterns
tail -f logs/architect-agent.log | grep "Request"
```

#### Solutions

**Resource Constraints**
```bash
# Scale up resources
docker update --memory=2g --cpus=2 na-agents-architect

# Scale horizontally
docker-compose up -d --scale architect-agent=2

# Monitor improvements
watch -n 1 'curl -w "%{time_total}s\n" -s -o /dev/null https://dev.agents.visualforge.ai:5001/health'
```

**Database/External Service Latency**
```bash
# Check DynamoDB performance
aws dynamodb describe-table --table-name na-agents-tasks --query 'Table.ProvisionedThroughput'

# Check external API response times
curl -w "%{time_total}s\n" -s -o /dev/null https://api.github.com

# Add connection pooling/caching
# Update agent configuration
```

### 6. WebSocket Connection Issues

#### Symptoms
- Chat interface not connecting
- Real-time updates not working
- "WebSocket connection failed"

#### Diagnostic Steps
```bash
# Test WebSocket connectivity
wscat -c wss://dev.agents.visualforge.ai:7000

# Check WebSocket upgrade headers
curl -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" https://dev.agents.visualforge.ai:7000

# Test with different clients
node -e "const WebSocket = require('ws'); const ws = new WebSocket('wss://dev.agents.visualforge.ai:7000'); ws.on('open', () => console.log('Connected')); ws.on('error', console.error);"
```

#### Solutions

**Proxy/Firewall Blocking WebSockets**
```bash
# Test direct connection
telnet dev.agents.visualforge.ai 7000

# Check for proxy settings
echo $http_proxy $https_proxy

# Try different port or fallback to polling
# Update client configuration
```

**Load Balancer Configuration**
```bash
# Check ALB WebSocket support
aws elbv2 describe-target-groups --target-group-arns arn:aws:elasticloadbalancing:region:account:targetgroup/na-agents/id

# Verify sticky sessions if needed
aws elbv2 describe-target-group-attributes --target-group-arn arn:aws:elasticloadbalancing:region:account:targetgroup/na-agents/id
```

### 7. Database Connection Issues

#### Symptoms
- "Unable to connect to DynamoDB"
- "Connection timeout"
- "Access denied" errors

#### Diagnostic Steps
```bash
# Test AWS credentials
aws sts get-caller-identity

# Test DynamoDB access
aws dynamodb list-tables
aws dynamodb describe-table --table-name na-agents-tasks

# Check IAM permissions
aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::account:role/na-agents-role --action-names dynamodb:GetItem --resource-arns arn:aws:dynamodb:region:account:table/na-agents-tasks
```

#### Solutions

**Missing Permissions**
```bash
# Update IAM role policy
aws iam attach-role-policy --role-name na-agents-role --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# Or create custom policy
aws iam create-policy --policy-name na-agents-dynamodb --policy-document file://iam-policy.json
```

**Network Connectivity**
```bash
# Check VPC endpoint
aws ec2 describe-vpc-endpoints --filters Name=service-name,Values=com.amazonaws.region.dynamodb

# Check security groups
aws ec2 describe-security-groups --group-ids sg-12345678

# Test from EC2 instance
aws dynamodb scan --table-name na-agents-tasks --max-items 1
```

## Debugging Workflows

### Agent Communication Flow
```bash
# 1. Check agent registration
curl -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/status

# 2. Submit test task
curl -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  https://dev.agents.visualforge.ai:5001/agent/ai-architect-agent-1/task \
  -d '{
    "taskId": "debug-test-123",
    "task": "Simple test task",
    "priority": 1
  }'

# 3. Monitor task progress
watch -n 5 'curl -s -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/queue | jq .'

# 4. Check agent logs
tail -f logs/architect-agent.log | grep "debug-test-123"
```

### GitHub Integration Debug
```bash
# 1. Test webhook endpoint
curl -X POST https://dev.agents.visualforge.ai:6000/github/webhook \
  -H "X-GitHub-Event: ping" \
  -H "X-Hub-Signature-256: sha256=test" \
  -H "Content-Type: application/json" \
  -d '{"zen": "test"}'

# 2. Check webhook logs
tail -f logs/github-service.log

# 3. Verify agent assignment
curl -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:6000/status
```

### Dashboard Integration Debug
```bash
# 1. Check dashboard connectivity
curl -X POST http://localhost:4001/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "id": "debug-agent",
    "type": "test",
    "port": 9999,
    "status": "online"
  }'

# 2. Send test heartbeat
curl -X POST http://localhost:4001/api/agents/debug-agent/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "status": "running",
    "metrics": {"cpuUsage": 10},
    "timestamp": "'$(date -Iseconds)'"
  }'

# 3. Verify registration
curl http://localhost:4001/api/agents
```

## Performance Debugging

### Response Time Analysis
```bash
# Create curl timing template
cat > curl-format.txt << 'EOF'
     time_namelookup:  %{time_namelookup}s
        time_connect:  %{time_connect}s
     time_appconnect:  %{time_appconnect}s
    time_pretransfer:  %{time_pretransfer}s
       time_redirect:  %{time_redirect}s
  time_starttransfer:  %{time_starttransfer}s
                     ----------
          time_total:  %{time_total}s
EOF

# Test endpoint performance
curl -w "@curl-format.txt" -s -o /dev/null https://dev.agents.visualforge.ai:5001/health
```

### Load Testing
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Simple load test
ab -n 100 -c 10 -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/health

# Sustained load test
ab -t 60 -c 5 -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/health
```

### Memory Leak Detection
```bash
# Monitor memory usage over time
while true; do
  echo "$(date): $(docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}' | grep na-agents)"
  sleep 60
done >> memory-usage.log

# Analyze memory patterns
grep "na-agents-architect" memory-usage.log | awk '{print $3}' | sed 's/MiB.*//' > memory-data.txt
```

## Log Analysis

### Centralized Logging
```bash
# Aggregate all agent logs
tail -f logs/*.log | grep -E "ERROR|WARN|Exception"

# Filter by specific patterns
grep -r "task.*failed" logs/
grep -r "connection.*timeout" logs/
grep -r "memory.*exceeded" logs/
```

### Error Pattern Analysis
```bash
# Count error types
grep -h "ERROR" logs/*.log | awk '{print $4}' | sort | uniq -c | sort -nr

# Find error spikes
grep "ERROR" logs/*.log | awk '{print $1" "$2}' | cut -d: -f1-2 | uniq -c | sort -nr

# Trace specific request
grep "request-id-12345" logs/*.log | sort
```

### Log Rotation Issues
```bash
# Check log sizes
du -sh logs/*

# Implement log rotation
logrotate -d /etc/logrotate.d/na-agents

# Manual log cleanup
find logs/ -name "*.log" -size +100M -exec gzip {} \;
```

## Emergency Procedures

### Service Recovery
```bash
#!/bin/bash
# emergency-recovery.sh

echo "Starting emergency recovery..."

# 1. Stop all services
docker-compose down

# 2. Clear any corrupted state
rm -f /tmp/na-agents-*.lock

# 3. Backup current logs
tar -czf "emergency-logs-$(date +%Y%m%d-%H%M%S).tar.gz" logs/

# 4. Start with minimal configuration
docker-compose up -d --scale architect-agent=1 --scale developer-agent=1

# 5. Wait and verify
sleep 30
for port in 5001 5002; do
  if curl -s -H "X-API-Key: $API_KEY" "https://dev.agents.visualforge.ai:$port/health" | grep -q "healthy"; then
    echo "Agent on port $port: OK"
  else
    echo "Agent on port $port: FAILED"
  fi
done

echo "Emergency recovery complete"
```

### Rollback Procedure
```bash
#!/bin/bash
# rollback.sh

echo "Starting rollback to previous version..."

# 1. Get current version
CURRENT_VERSION=$(docker images na-agents --format "{{.Tag}}" | head -1)
echo "Current version: $CURRENT_VERSION"

# 2. Find previous version
PREVIOUS_VERSION=$(docker images na-agents --format "{{.Tag}}" | sed -n '2p')
echo "Rolling back to: $PREVIOUS_VERSION"

# 3. Update docker-compose
sed -i "s/na-agents:$CURRENT_VERSION/na-agents:$PREVIOUS_VERSION/g" docker-compose.yml

# 4. Deploy previous version
docker-compose down
docker-compose up -d

# 5. Verify rollback
sleep 30
./scripts/verify-deployment.sh

echo "Rollback complete"
```

## Monitoring and Alerts

### Health Check Script
```bash
#!/bin/bash
# health-check.sh - Run every 5 minutes via cron

ERROR_COUNT=0
ALERT_THRESHOLD=3

# Check each agent
for port in 5001 5002 5003 5004 5005; do
  if ! curl -s -f -H "X-API-Key: $API_KEY" "https://dev.agents.visualforge.ai:$port/health" > /dev/null; then
    echo "$(date): Agent on port $port is unhealthy" >> /var/log/na-agents-health.log
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done

# Send alert if threshold exceeded
if [ $ERROR_COUNT -ge $ALERT_THRESHOLD ]; then
  echo "$(date): ALERT - $ERROR_COUNT agents are unhealthy" | mail -s "NA-Agents Health Alert" ops@niroagent.com
fi
```

### Performance Monitoring
```bash
#!/bin/bash
# performance-monitor.sh

# Monitor response times
RESPONSE_TIME=$(curl -w "%{time_total}" -s -o /dev/null -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/health)

# Alert if response time > 2 seconds
if (( $(echo "$RESPONSE_TIME > 2.0" | bc -l) )); then
  echo "$(date): High response time: ${RESPONSE_TIME}s" >> /var/log/na-agents-perf.log
fi

# Monitor resource usage
MEM_USAGE=$(docker stats --no-stream --format "{{.MemPerc}}" na-agents-architect | sed 's/%//')
if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
  echo "$(date): High memory usage: ${MEM_USAGE}%" >> /var/log/na-agents-perf.log
fi
```

## Getting Help

### Support Channels
- **Emergency**: emergency@niroagent.com
- **Technical Support**: support@niroagent.com
- **GitHub Issues**: https://github.com/NiroAgent/na-agents/issues
- **Documentation**: https://docs.niroagent.com

### Information to Include
When reporting issues, please include:

1. **Environment Information**
   ```bash
   echo "Environment: $(uname -a)"
   echo "Docker Version: $(docker --version)"
   echo "Node.js Version: $(node --version)"
   echo "Agent Version: $(docker inspect na-agents:latest | jq '.[0].Config.Labels.version')"
   ```

2. **Error Details**
   - Complete error message
   - Stack trace (if available)
   - Timestamp of occurrence
   - Steps to reproduce

3. **System State**
   ```bash
   # Include output of these commands
   docker ps
   docker logs na-agents-architect --tail 50
   curl -s -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/status
   ```

---

*Last Updated: August 21, 2025*  
*Troubleshooting Guide Version: 1.0*  
*Support Level: Production Ready*