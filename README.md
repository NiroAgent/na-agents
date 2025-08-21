# AI Agent Deployment Package

## Quick Start

### 1. Manual Agent Processing
```bash
# Set your GitHub token
export GITHUB_TOKEN="your_github_token_here"
export GITHUB_REPO="owner/repository"

# Process a specific issue
python enhanced-batch-agent-processor.py
```

### 2. Docker Processing
```bash
# Build the container
docker build -t ai-agents/agent-processor .

# Run for a specific issue
docker run --rm \
  -e GITHUB_TOKEN="$GITHUB_TOKEN" \
  -e GITHUB_REPO="owner/repo" \
  -e ISSUE_NUMBER="123" \
  -e AGENT_TYPE="developer" \
  ai-agents/agent-processor:latest
```

### 3. GitHub Actions (Automated)
1. Copy `.github/workflows/ai-agent-processor.yml` to your repository
2. Add these repository secrets:
   - `AWS_ACCESS_KEY_ID` (if using AWS)
   - `AWS_SECRET_ACCESS_KEY` (if using AWS)
3. Add these repository variables:
   - `AWS_REGION` (default: us-east-1)
   - `USE_DIRECT_PROCESSING=true` (to process directly in GitHub Actions)

## Supported Agents

- **Developer Agent**: Handles bugs, features, code changes
- **Architect Agent**: Handles design and architecture issues  
- **QA Agent**: Handles testing and quality assurance
- **DevOps Agent**: Handles deployment and infrastructure
- **Manager Agent**: Handles strategy and management decisions
- **Support Agent**: Handles customer support issues
- **Security Agent**: Handles security vulnerabilities
- **Analytics Agent**: Handles reporting and data analysis

## Agent Selection

Agents are automatically selected based on:
1. **Issue labels** (highest priority)
2. **Title keywords** 
3. **Body content patterns**

### Label Mapping
- `bug`, `feature`, `enhancement` -> Developer Agent
- `architecture`, `design` -> Architect Agent  
- `testing`, `qa`, `quality` -> QA Agent
- `deployment`, `infrastructure`, `devops` -> DevOps Agent
- `security`, `vulnerability` -> Security Agent
- `support`, `help` -> Support Agent
- `analytics`, `reporting` -> Analytics Agent
- `management`, `strategy` -> Manager Agent

## Configuration

All configuration is handled through environment variables:
- `GITHUB_TOKEN`: GitHub personal access token
- `GITHUB_REPO`: Repository in format "owner/repo"  
- `ISSUE_NUMBER`: Issue number to process
- `AGENT_TYPE`: Agent type to use
- `AWS_REGION`: AWS region (if using AWS)
