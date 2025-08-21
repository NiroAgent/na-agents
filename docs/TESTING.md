# 🧪 NA-Agents Testing Documentation

## Overview

Comprehensive testing documentation for the NA-Agents multi-agent system, covering unit tests, integration tests, end-to-end testing, performance testing, and CI/CD integration.

## Test Structure

```
tests/
├── unit/           # Unit tests for individual components
├── integration/    # Integration tests between services
├── e2e/           # End-to-end testing scenarios
├── performance/   # Performance and load testing
├── security/      # Security testing
├── fixtures/      # Test data and mock objects
└── regression-test.js  # Main regression test suite
```

## Running Tests

### Local Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance

# Run regression tests
npm run test:regression
npm run test:regression:dev    # Against dev environment
npm run test:regression:stg    # Against staging environment
npm run test:regression:prd    # Against production environment
```

### Environment-Specific Testing
```bash
# Development environment
npm run test:regression:dev
# Tests against: https://dev.agents.visualforge.ai
# Success threshold: 70%

# Staging environment  
npm run test:regression:stg
# Tests against: https://stg.agents.visualforge.ai
# Success threshold: 80%

# Production environment
npm run test:regression:prd
# Tests against: https://agents.visualforge.ai
# Success threshold: 95%
```

## Test Categories

### Unit Tests
- Individual agent functionality
- Service method testing
- Utility function validation
- Error handling verification

### Integration Tests
- Agent-to-agent communication
- Service integration testing
- Database connectivity
- External API integration

### End-to-End Tests
- Complete user workflows
- Multi-agent task coordination
- Dashboard integration
- WebSocket communication

### Performance Tests
- Load testing (100 concurrent requests)
- Stress testing (1000 requests/minute)
- Memory usage monitoring
- Response time validation

### Security Tests
- API key authentication
- Input validation
- Rate limiting verification
- CORS policy testing

## CI/CD Testing Integration

### GitHub Actions Workflows
```yaml
# .github/workflows/test.yml
name: Test Suite
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run regression tests
        run: npm run test:regression:dev
```

### Automated Testing Pipeline
1. **Code Push** → **Unit Tests** → **Integration Tests** → **Security Scan** → **Deploy to Dev** → **E2E Tests** → **Performance Tests** → **Staging Approval**

## Test Configuration

### Environment Variables
```bash
# Test environment configuration
TEST_BASE_URL=https://dev.agents.visualforge.ai
TEST_TIMEOUT=30000
TEST_API_KEY=test-api-key
TEST_SUCCESS_THRESHOLD=70
```

### Test Data
- Mock agent responses in `tests/fixtures/`
- Sample task payloads
- Test user profiles
- API response templates

## Regression Testing

### Test Suite Overview
The regression test suite (`regression-test.js`) includes 38 comprehensive tests:

1. **Agent Health Checks** (5 tests)
   - Architect Agent health
   - Developer Agent health
   - DevOps Agent health
   - QA Agent health
   - Manager Agent health

2. **API Authentication** (5 tests)
   - Valid API key acceptance
   - Invalid API key rejection
   - Missing API key handling
   - Rate limiting verification
   - CORS policy validation

3. **Task Assignment** (10 tests)
   - Task creation and queuing
   - Priority-based processing
   - Multi-agent coordination
   - Error handling
   - Timeout management

4. **Communication Tests** (8 tests)
   - Agent-to-agent messaging
   - WebSocket connectivity
   - Real-time updates
   - Message queuing

5. **Integration Tests** (10 tests)
   - GitHub webhook integration
   - Dashboard connectivity
   - Database operations
   - External service calls

### Test Execution
```bash
# Basic regression test
node regression-test.js

# Environment-specific testing
node regression-test.js --url https://dev.agents.visualforge.ai --threshold 70
node regression-test.js --url https://stg.agents.visualforge.ai --threshold 80
node regression-test.js --url https://agents.visualforge.ai --threshold 95

# Detailed reporting
node regression-test.js --verbose --report-file test-results.json
```

## Performance Benchmarks

### Target Metrics
```
Response Time: ≤ 200ms (API endpoints)
Throughput: ≥ 1000 requests/minute per agent
Memory Usage: ≤ 512MB per agent
CPU Usage: ≤ 25% per agent
Uptime: ≥ 99.9%
Error Rate: ≤ 0.1%
```

### Load Testing Scenarios
1. **Normal Load**: 10 concurrent users
2. **Peak Load**: 100 concurrent users
3. **Stress Test**: 1000 requests in 1 minute
4. **Endurance Test**: 24-hour continuous operation

## Security Testing

### Security Test Categories
1. **Authentication Testing**
   - API key validation
   - Token expiration
   - Permission verification

2. **Input Validation**
   - SQL injection prevention
   - XSS protection
   - Command injection prevention

3. **Rate Limiting**
   - API rate limits
   - Burst protection
   - DDoS mitigation

4. **Data Protection**
   - Sensitive data masking
   - Secure communication
   - Audit logging

## Troubleshooting

### Common Test Failures

#### Agent Not Responding
```bash
# Check agent status
curl https://dev.agents.visualforge.ai:5001/health

# Check logs
docker logs architect-agent
```

#### Authentication Failures
```bash
# Verify API key
echo $API_KEY

# Test authentication
curl -H "X-API-Key: $API_KEY" https://dev.agents.visualforge.ai:5001/status
```

#### Performance Issues
```bash
# Monitor resource usage
docker stats

# Check response times
curl -w "@curl-format.txt" -s -o /dev/null https://dev.agents.visualforge.ai:5001/health
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=na-agents:* npm test

# Run single test with debug
DEBUG=na-agents:* npm run test:unit -- --grep "specific test"
```

## Test Reports

### Generated Reports
- `test-results.json` - Detailed test execution results
- `coverage-report.html` - Code coverage analysis
- `performance-report.json` - Performance metrics
- `security-scan.json` - Security vulnerability report

### Report Analysis
```bash
# View test summary
cat test-results.json | jq '.summary'

# Check coverage
open coverage-report.html

# Analyze performance
cat performance-report.json | jq '.metrics'
```

## Continuous Improvement

### Test Maintenance
1. **Weekly**: Review and update test cases
2. **Monthly**: Performance baseline updates
3. **Quarterly**: Security test enhancement
4. **Annually**: Complete test suite review

### Metrics Tracking
- Test execution time trends
- Success rate improvements
- Performance regression detection
- Security vulnerability trends

---

*Last Updated: August 21, 2025*  
*Documentation Status: Consolidated from CI_CD_TESTING_GUIDE.md and COMPREHENSIVE_TEST_REPORT.md*