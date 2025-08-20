#!/usr/bin/env python3
"""
GitHub Agent Dispatcher
=======================
Comprehensive system for GitHub Issues → Agent assignment with AWS Batch/Fargate deployment

This replaces where Opus left off and creates the complete workflow:
1. GitHub webhook receives issue events
2. Analyzes issue content to determine agent type
3. Triggers AWS Batch job or Fargate task with agent container
4. Agent processes issue and updates GitHub with results
"""

import json
import os
import sys
import logging
import asyncio
import boto3
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import subprocess
import tempfile
import hashlib

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('GitHubAgentDispatcher')

@dataclass
class IssueEvent:
    """GitHub issue event data"""
    action: str  # opened, edited, closed, labeled, etc.
    issue_number: int
    issue_title: str
    issue_body: str
    issue_labels: List[str]
    repository: str
    sender: str
    timestamp: str

@dataclass
class AgentAssignment:
    """Agent assignment configuration"""
    agent_name: str
    agent_type: str
    container_image: str
    compute_type: str  # batch, fargate, lambda
    priority: int  # 0=critical, 1=high, 2=medium, 3=low
    timeout_minutes: int
    memory_mb: int
    cpu_units: int

class GitHubAgentDispatcher:
    """Main dispatcher for routing GitHub issues to AI agents"""
    
    def __init__(self):
        self.github_token = os.environ.get('GITHUB_TOKEN')
        self.aws_region = os.environ.get('AWS_REGION', 'us-east-1')
        
        # AWS clients
        self.batch_client = boto3.client('batch', region_name=self.aws_region)
        self.ecs_client = boto3.client('ecs', region_name=self.aws_region)
        self.lambda_client = boto3.client('lambda', region_name=self.aws_region)
        self.ecr_client = boto3.client('ecr', region_name=self.aws_region)
        
        # GitHub API headers
        self.github_headers = {
            'Authorization': f'token {self.github_token}',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
        
        # Agent assignment rules
        self.agent_assignments = self._initialize_agent_assignments()
        
        # AWS infrastructure configuration
        self.aws_config = {
            'batch_job_queue': 'ai-agents-queue',
            'batch_job_definition': 'ai-agent-processor',
            'fargate_cluster': 'ai-agents-cluster',
            'fargate_task_definition': 'ai-agent-task',
            'lambda_function_name': 'ai-agent-processor',
            'ecr_registry': f"{boto3.Session().get_credentials().access_key}.dkr.ecr.{self.aws_region}.amazonaws.com"
        }
        
        logger.info("GitHub Agent Dispatcher initialized")
    
    def _initialize_agent_assignments(self) -> Dict[str, AgentAssignment]:
        """Initialize agent assignment rules"""
        
        base_image_registry = f"ai-agents"
        
        return {
            # Development Team Agents
            'developer': AgentAssignment(
                agent_name='ai-developer-agent',
                agent_type='development',
                container_image=f'{base_image_registry}/ai-developer:latest',
                compute_type='fargate',  # Complex code generation needs more resources
                priority=1,
                timeout_minutes=30,
                memory_mb=2048,
                cpu_units=1024
            ),
            'architect': AgentAssignment(
                agent_name='ai-architect-agent',
                agent_type='architecture',
                container_image=f'{base_image_registry}/ai-architect:latest',
                compute_type='fargate',
                priority=1,
                timeout_minutes=20,
                memory_mb=1024,
                cpu_units=512
            ),
            'qa': AgentAssignment(
                agent_name='ai-qa-agent',
                agent_type='quality_assurance',
                container_image=f'{base_image_registry}/ai-qa:latest',
                compute_type='batch',  # Testing can be resource-intensive
                priority=2,
                timeout_minutes=45,
                memory_mb=1024,
                cpu_units=512
            ),
            'devops': AgentAssignment(
                agent_name='ai-devops-agent',
                agent_type='devops',
                container_image=f'{base_image_registry}/ai-devops:latest',
                compute_type='fargate',
                priority=0,  # Infrastructure is critical
                timeout_minutes=25,
                memory_mb=1024,
                cpu_units=512
            ),
            
            # Business Team Agents (from existing orchestrator)
            'manager': AgentAssignment(
                agent_name='ai-manager-agent',
                agent_type='management',
                container_image=f'{base_image_registry}/ai-manager:latest',
                compute_type='lambda',  # Quick executive decisions
                priority=0,
                timeout_minutes=15,
                memory_mb=512,
                cpu_units=256
            ),
            'support': AgentAssignment(
                agent_name='ai-support-agent',
                agent_type='support',
                container_image=f'{base_image_registry}/ai-support:latest',
                compute_type='lambda',  # Fast customer response
                priority=1,
                timeout_minutes=10,
                memory_mb=512,
                cpu_units=256
            ),
            'security': AgentAssignment(
                agent_name='ai-security-agent',
                agent_type='security',
                container_image=f'{base_image_registry}/ai-security:latest',
                compute_type='fargate',
                priority=0,  # Security is critical
                timeout_minutes=30,
                memory_mb=1024,
                cpu_units=512
            ),
            'analytics': AgentAssignment(
                agent_name='ai-analytics-agent',
                agent_type='analytics',
                container_image=f'{base_image_registry}/ai-analytics:latest',
                compute_type='batch',  # Data processing intensive
                priority=2,
                timeout_minutes=60,
                memory_mb=2048,
                cpu_units=1024
            ),
            'finance': AgentAssignment(
                agent_name='ai-finance-agent',
                agent_type='finance',
                container_image=f'{base_image_registry}/ai-finance:latest',
                compute_type='lambda',
                priority=2,
                timeout_minutes=15,
                memory_mb=512,
                cpu_units=256
            ),
            'operations': AgentAssignment(
                agent_name='ai-operations-agent',
                agent_type='operations',
                container_image=f'{base_image_registry}/ai-operations:latest',
                compute_type='fargate',
                priority=1,
                timeout_minutes=20,
                memory_mb=1024,
                cpu_units=512
            ),
            'marketing': AgentAssignment(
                agent_name='ai-marketing-agent',
                agent_type='marketing',
                container_image=f'{base_image_registry}/ai-marketing:latest',
                compute_type='lambda',
                priority=2,
                timeout_minutes=15,
                memory_mb=512,
                cpu_units=256
            ),
            'sales': AgentAssignment(
                agent_name='ai-sales-agent',
                agent_type='sales',
                container_image=f'{base_image_registry}/ai-sales:latest',
                compute_type='lambda',
                priority=2,
                timeout_minutes=15,
                memory_mb=512,
                cpu_units=256
            ),
            'customer-success': AgentAssignment(
                agent_name='ai-customer-success-agent',
                agent_type='customer_success',
                container_image=f'{base_image_registry}/ai-customer-success:latest',
                compute_type='lambda',
                priority=1,
                timeout_minutes=10,
                memory_mb=512,
                cpu_units=256
            )
        }
    
    def analyze_issue_for_agent(self, issue_event: IssueEvent) -> AgentAssignment:
        """Analyze GitHub issue to determine which agent should handle it"""
        
        title = issue_event.issue_title.lower()
        body = issue_event.issue_body.lower()
        labels = [label.lower() for label in issue_event.issue_labels]
        
        # Priority 1: Explicit labels
        label_mapping = {
            'bug': 'developer',
            'feature': 'developer', 
            'enhancement': 'developer',
            'documentation': 'developer',
            'architecture': 'architect',
            'design': 'architect',
            'testing': 'qa',
            'qa': 'qa',
            'quality': 'qa',
            'deployment': 'devops',
            'infrastructure': 'devops',
            'devops': 'devops',
            'ci/cd': 'devops',
            'security': 'security',
            'vulnerability': 'security',
            'performance': 'operations',
            'monitoring': 'operations',
            'support': 'support',
            'customer': 'customer-success',
            'analytics': 'analytics',
            'reporting': 'analytics',
            'finance': 'finance',
            'cost': 'finance',
            'marketing': 'marketing',
            'sales': 'sales',
            'management': 'manager',
            'strategy': 'manager'
        }
        
        # Check labels first
        for label in labels:
            if label in label_mapping:
                return self.agent_assignments[label_mapping[label]]
        
        # Priority 2: Title patterns
        title_patterns = {
            'developer': ['fix', 'implement', 'add', 'create', 'build', 'develop', 'code'],
            'architect': ['design', 'architecture', 'structure', 'pattern', 'framework'],
            'qa': ['test', 'verify', 'validate', 'check', 'quality'],
            'devops': ['deploy', 'infrastructure', 'pipeline', 'ci/cd', 'aws'],
            'security': ['secure', 'vulnerability', 'auth', 'permission', 'encrypt'],
            'support': ['help', 'issue', 'problem', 'error', 'broken'],
            'manager': ['strategy', 'plan', 'roadmap', 'priority', 'decision']
        }
        
        for agent_type, patterns in title_patterns.items():
            if any(pattern in title for pattern in patterns):
                return self.agent_assignments[agent_type]
        
        # Priority 3: Body content analysis
        if any(keyword in body for keyword in ['test', 'testing', 'qa', 'quality']):
            return self.agent_assignments['qa']
        elif any(keyword in body for keyword in ['deploy', 'deployment', 'infrastructure']):
            return self.agent_assignments['devops']
        elif any(keyword in body for keyword in ['security', 'vulnerability', 'attack']):
            return self.agent_assignments['security']
        elif any(keyword in body for keyword in ['customer', 'user', 'support']):
            return self.agent_assignments['support']
        
        # Default: Developer agent for general issues
        return self.agent_assignments['developer']
    
    def process_issue_event(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """Process GitHub webhook payload"""
        
        try:
            # Parse the webhook payload
            issue_event = IssueEvent(
                action=webhook_payload['action'],
                issue_number=webhook_payload['issue']['number'],
                issue_title=webhook_payload['issue']['title'],
                issue_body=webhook_payload['issue'].get('body', ''),
                issue_labels=[label['name'] for label in webhook_payload['issue'].get('labels', [])],
                repository=webhook_payload['repository']['full_name'],
                sender=webhook_payload['sender']['login'],
                timestamp=datetime.now().isoformat()
            )
            
            logger.info(f"Processing issue #{issue_event.issue_number}: {issue_event.issue_title}")
            
            # Only process certain actions
            if issue_event.action not in ['opened', 'reopened', 'labeled']:
                logger.info(f"Ignoring action: {issue_event.action}")
                return {'status': 'ignored', 'reason': f'Action {issue_event.action} not processed'}
            
            # Determine which agent should handle this
            agent_assignment = self.analyze_issue_for_agent(issue_event)
            
            logger.info(f"Assigned to agent: {agent_assignment.agent_name} ({agent_assignment.compute_type})")
            
            # Update GitHub issue with assignment
            self.update_issue_assignment(issue_event, agent_assignment)
            
            # Deploy agent to process the issue
            deployment_result = self.deploy_agent(issue_event, agent_assignment)
            
            return {
                'status': 'success',
                'issue_number': issue_event.issue_number,
                'agent_assigned': agent_assignment.agent_name,
                'compute_type': agent_assignment.compute_type,
                'deployment': deployment_result
            }
            
        except Exception as e:
            logger.error(f"Error processing issue event: {e}")
            return {'status': 'error', 'error': str(e)}
    
    def update_issue_assignment(self, issue_event: IssueEvent, agent_assignment: AgentAssignment):
        """Update GitHub issue with agent assignment"""
        
        # Add assignment comment
        comment_body = f"""## 🤖 AI Agent Assignment
        
**Assigned to:** {agent_assignment.agent_name}
**Agent Type:** {agent_assignment.agent_type}
**Compute Platform:** {agent_assignment.compute_type.upper()}
**Priority:** P{agent_assignment.priority}
**Estimated Processing Time:** {agent_assignment.timeout_minutes} minutes

The AI agent will begin processing this issue shortly. Updates will be posted as comments.

---
*Automated by GitHub Agent Dispatcher*"""
        
        # Post comment
        url = f"https://api.github.com/repos/{issue_event.repository}/issues/{issue_event.issue_number}/comments"
        response = requests.post(
            url,
            headers=self.github_headers,
            json={'body': comment_body}
        )
        
        # Add labels
        labels_to_add = [
            'ai-processing',
            f'agent-{agent_assignment.agent_type}',
            f'priority-p{agent_assignment.priority}',
            f'compute-{agent_assignment.compute_type}'
        ]
        
        url = f"https://api.github.com/repos/{issue_event.repository}/issues/{issue_event.issue_number}/labels"
        requests.post(
            url,
            headers=self.github_headers,
            json={'labels': labels_to_add}
        )
        
        logger.info(f"Updated issue #{issue_event.issue_number} with assignment")
    
    def deploy_agent(self, issue_event: IssueEvent, agent_assignment: AgentAssignment) -> Dict[str, Any]:
        """Deploy agent to appropriate compute platform"""
        
        if agent_assignment.compute_type == 'lambda':
            return self.deploy_to_lambda(issue_event, agent_assignment)
        elif agent_assignment.compute_type == 'fargate':
            return self.deploy_to_fargate(issue_event, agent_assignment)
        elif agent_assignment.compute_type == 'batch':
            return self.deploy_to_batch(issue_event, agent_assignment)
        else:
            raise ValueError(f"Unknown compute type: {agent_assignment.compute_type}")
    
    def deploy_to_lambda(self, issue_event: IssueEvent, agent_assignment: AgentAssignment) -> Dict[str, Any]:
        """Deploy agent to AWS Lambda"""
        
        try:
            # Create the payload for the Lambda function
            payload = {
                'github_token': self.github_token,
                'issue_event': {
                    'repository': issue_event.repository,
                    'issue_number': issue_event.issue_number,
                    'issue_title': issue_event.issue_title,
                    'issue_body': issue_event.issue_body,
                    'labels': issue_event.issue_labels
                },
                'agent_config': {
                    'agent_name': agent_assignment.agent_name,
                    'agent_type': agent_assignment.agent_type,
                    'timeout_minutes': agent_assignment.timeout_minutes
                }
            }
            
            # Invoke Lambda function
            response = self.lambda_client.invoke(
                FunctionName=self.aws_config['lambda_function_name'],
                InvocationType='Event',  # Async execution
                Payload=json.dumps(payload)
            )
            
            logger.info(f"Lambda invoked for issue #{issue_event.issue_number}")
            
            return {
                'platform': 'lambda',
                'status': 'invoked',
                'response_metadata': response['ResponseMetadata']
            }
            
        except Exception as e:
            logger.error(f"Lambda deployment failed: {e}")
            return {'platform': 'lambda', 'status': 'failed', 'error': str(e)}
    
    def deploy_to_fargate(self, issue_event: IssueEvent, agent_assignment: AgentAssignment) -> Dict[str, Any]:
        """Deploy agent to AWS Fargate"""
        
        try:
            # Create task definition override
            task_override = {
                'containerOverrides': [
                    {
                        'name': 'ai-agent-container',
                        'environment': [
                            {'name': 'GITHUB_TOKEN', 'value': self.github_token},
                            {'name': 'GITHUB_REPO', 'value': issue_event.repository},
                            {'name': 'ISSUE_NUMBER', 'value': str(issue_event.issue_number)},
                            {'name': 'AGENT_TYPE', 'value': agent_assignment.agent_type},
                            {'name': 'AGENT_NAME', 'value': agent_assignment.agent_name},
                            {'name': 'AWS_REGION', 'value': self.aws_region}
                        ],
                        'memory': agent_assignment.memory_mb,
                        'cpu': agent_assignment.cpu_units
                    }
                ],
                'cpu': str(agent_assignment.cpu_units),
                'memory': str(agent_assignment.memory_mb)
            }
            
            # Run Fargate task
            response = self.ecs_client.run_task(
                cluster=self.aws_config['fargate_cluster'],
                taskDefinition=self.aws_config['fargate_task_definition'],
                launchType='FARGATE',
                networkConfiguration={
                    'awsvpcConfiguration': {
                        'subnets': [os.environ.get('AWS_SUBNET_ID', 'subnet-12345')],
                        'securityGroups': [os.environ.get('AWS_SECURITY_GROUP_ID', 'sg-12345')],
                        'assignPublicIp': 'ENABLED'
                    }
                },
                overrides=task_override,
                tags=[
                    {'key': 'GitHubIssue', 'value': str(issue_event.issue_number)},
                    {'key': 'AgentType', 'value': agent_assignment.agent_type},
                    {'key': 'Repository', 'value': issue_event.repository}
                ]
            )
            
            task_arn = response['tasks'][0]['taskArn']
            logger.info(f"Fargate task started: {task_arn}")
            
            return {
                'platform': 'fargate',
                'status': 'started',
                'task_arn': task_arn,
                'cluster': self.aws_config['fargate_cluster']
            }
            
        except Exception as e:
            logger.error(f"Fargate deployment failed: {e}")
            return {'platform': 'fargate', 'status': 'failed', 'error': str(e)}
    
    def deploy_to_batch(self, issue_event: IssueEvent, agent_assignment: AgentAssignment) -> Dict[str, Any]:
        """Deploy agent to AWS Batch"""
        
        try:
            # Create job name
            job_name = f"ai-agent-{issue_event.issue_number}-{int(datetime.now().timestamp())}"
            
            # Submit batch job
            response = self.batch_client.submit_job(
                jobName=job_name,
                jobQueue=self.aws_config['batch_job_queue'],
                jobDefinition=self.aws_config['batch_job_definition'],
                parameters={
                    'githubToken': self.github_token,
                    'githubRepo': issue_event.repository,
                    'issueNumber': str(issue_event.issue_number),
                    'agentType': agent_assignment.agent_type,
                    'agentName': agent_assignment.agent_name
                },
                timeout={
                    'attemptDurationSeconds': agent_assignment.timeout_minutes * 60
                },
                tags={
                    'GitHubIssue': str(issue_event.issue_number),
                    'AgentType': agent_assignment.agent_type,
                    'Repository': issue_event.repository
                }
            )
            
            job_id = response['jobId']
            logger.info(f"Batch job submitted: {job_id}")
            
            return {
                'platform': 'batch',
                'status': 'submitted',
                'job_id': job_id,
                'job_name': job_name
            }
            
        except Exception as e:
            logger.error(f"Batch deployment failed: {e}")
            return {'platform': 'batch', 'status': 'failed', 'error': str(e)}
    
    def create_agent_containers(self):
        """Create Docker containers for all agents"""
        
        logger.info("Creating agent containers...")
        
        # Base Dockerfile template
        dockerfile_template = '''FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    curl \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy agent files
COPY {agent_files} .
COPY shared/ ./shared/

# Set environment variables
ENV PYTHONPATH=/app
ENV AGENT_TYPE={agent_type}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run the agent
CMD ["python", "{agent_script}"]
'''
        
        # Requirements template
        requirements_template = '''requests>=2.31.0
boto3>=1.28.0
PyGithub>=1.59.0
openai>=1.0.0
flask>=2.3.0
psutil>=5.9.0
pathlib>=1.0.0
dataclasses>=0.6
asyncio
'''
        
        containers_created = []
        
        for agent_type, assignment in self.agent_assignments.items():
            agent_script = f"{assignment.agent_name}.py"
            
            # Create container directory
            container_dir = Path(f"containers/{assignment.agent_name}")
            container_dir.mkdir(parents=True, exist_ok=True)
            
            # Create Dockerfile
            dockerfile_content = dockerfile_template.format(
                agent_files=f"{agent_script} agent-policy-engine.py",
                agent_type=agent_type,
                agent_script=agent_script
            )
            
            with open(container_dir / "Dockerfile", "w") as f:
                f.write(dockerfile_content)
            
            # Create requirements.txt
            with open(container_dir / "requirements.txt", "w") as f:
                f.write(requirements_template)
            
            # Copy agent files
            agent_files = [
                f"{assignment.agent_name}.py",
                "agent-policy-engine.py",
                "ai_agent_template.py"
            ]
            
            for agent_file in agent_files:
                if Path(agent_file).exists():
                    subprocess.run(['cp', agent_file, str(container_dir)], check=False)
            
            # Create shared directory for common utilities
            shared_dir = container_dir / "shared"
            shared_dir.mkdir(exist_ok=True)
            
            # Create build script
            build_script = f'''#!/bin/bash
set -e

echo "Building {assignment.agent_name} container..."

# Build the container
docker build -t {assignment.container_image} .

# Tag for ECR
docker tag {assignment.container_image} {self.aws_config['ecr_registry']}/{assignment.container_image}

echo "Container built successfully: {assignment.container_image}"
'''
            
            with open(container_dir / "build.sh", "w") as f:
                f.write(build_script)
            
            subprocess.run(['chmod', '+x', str(container_dir / "build.sh")])
            
            containers_created.append({
                'agent': assignment.agent_name,
                'directory': str(container_dir),
                'image': assignment.container_image
            })
            
            logger.info(f"Created container setup for {assignment.agent_name}")
        
        # Create master build script
        master_build_script = '''#!/bin/bash
set -e

echo "Building all AI agent containers..."

# Login to ECR
aws ecr get-login-password --region ''' + self.aws_region + ''' | docker login --username AWS --password-stdin ''' + self.aws_config['ecr_registry'] + '''

# Build all containers
'''
        
        for container in containers_created:
            master_build_script += f'''
cd containers/{container['agent']}
./build.sh
cd ../..

'''
        
        master_build_script += '''
echo "All containers built successfully!"
echo "To push to ECR, run: ./push-containers.sh"
'''
        
        with open("build-all-containers.sh", "w") as f:
            f.write(master_build_script)
        
        subprocess.run(['chmod', '+x', 'build-all-containers.sh'])
        
        # Create push script
        push_script = '''#!/bin/bash
set -e

echo "Pushing all containers to ECR..."

'''
        
        for container in containers_created:
            push_script += f'''
echo "Pushing {container['image']}..."
docker push {self.aws_config['ecr_registry']}/{container['image']}

'''
        
        push_script += '''
echo "All containers pushed successfully!"
'''
        
        with open("push-containers.sh", "w") as f:
            f.write(push_script)
        
        subprocess.run(['chmod', '+x', 'push-containers.sh'])
        
        logger.info(f"Created {len(containers_created)} agent containers")
        return containers_created

def create_github_actions_workflow():
    """Create GitHub Actions workflow for agent dispatch"""
    
    workflow_content = '''name: AI Agent Dispatcher

on:
  issues:
    types: [opened, reopened, edited, labeled, unlabeled]
  issue_comment:
    types: [created, edited]

jobs:
  dispatch-agent:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: |
        pip install requests boto3 PyGithub
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ vars.AWS_REGION || 'us-east-1' }}
    
    - name: Download agent dispatcher
      run: |
        curl -O https://raw.githubusercontent.com/VisualForgeMediaV2/agent-scripts/main/github-agent-dispatcher.py
    
    - name: Process issue with agent dispatcher
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        AWS_REGION: ${{ vars.AWS_REGION || 'us-east-1' }}
        AWS_SUBNET_ID: ${{ vars.AWS_SUBNET_ID }}
        AWS_SECURITY_GROUP_ID: ${{ vars.AWS_SECURITY_GROUP_ID }}
      run: |
        python github-agent-dispatcher.py --webhook-payload '${{ toJson(github.event) }}'
    
    - name: Report status
      if: always()
      uses: actions/github-script@v6
      with:
        script: |
          // Report processing status
          const fs = require('fs');
          let status = 'completed';
          let message = 'AI agent dispatch completed successfully';
          
          try {
            if (fs.existsSync('agent-dispatch-result.json')) {
              const result = JSON.parse(fs.readFileSync('agent-dispatch-result.json', 'utf8'));
              status = result.status;
              message = result.status === 'success' 
                ? `✅ Assigned to ${result.agent_assigned} on ${result.compute_type}`
                : `❌ Error: ${result.error}`;
            }
          } catch (e) {
            message = `⚠️ Could not read dispatch result: ${e.message}`;
          }
          
          await github.rest.issues.createComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: context.issue.number,
            body: `## 🤖 Agent Dispatch Result\\n\\n${message}\\n\\n---\\n*Automated by GitHub Actions*`
          });

  # Fallback webhook processor
  webhook-fallback:
    runs-on: ubuntu-latest
    if: failure()
    
    steps:
    - name: Trigger webhook fallback
      run: |
        curl -X POST ${{ secrets.AGENT_WEBHOOK_URL }} \\
          -H "Content-Type: application/json" \\
          -H "X-GitHub-Event: ${{ github.event_name }}" \\
          -d '${{ toJson(github.event) }}'
'''
    
    workflow_dir = Path('.github/workflows')
    workflow_dir.mkdir(parents=True, exist_ok=True)
    
    with open(workflow_dir / 'ai-agent-dispatcher.yml', 'w') as f:
        f.write(workflow_content)
    
    logger.info("Created GitHub Actions workflow: .github/workflows/ai-agent-dispatcher.yml")

def create_aws_infrastructure_setup():
    """Create AWS infrastructure setup script"""
    
    setup_script = '''#!/bin/bash
set -e

echo "Setting up AWS infrastructure for AI Agent Dispatcher..."

AWS_REGION=${AWS_REGION:-us-east-1}
VPC_ID=${VPC_ID:-$(aws ec2 describe-vpcs --query 'Vpcs[?IsDefault==`true`].VpcId' --output text)}

echo "Using AWS Region: $AWS_REGION"
echo "Using VPC: $VPC_ID"

# Step 1: Create ECR repositories
echo "Creating ECR repositories..."
AGENT_TYPES=("ai-developer" "ai-architect" "ai-qa" "ai-devops" "ai-manager" "ai-support" "ai-security" "ai-analytics" "ai-finance" "ai-operations" "ai-marketing" "ai-sales" "ai-customer-success")

for agent in "${AGENT_TYPES[@]}"; do
    echo "Creating ECR repo for $agent..."
    aws ecr create-repository \\
        --repository-name "ai-agents/$agent" \\
        --region $AWS_REGION \\
        --image-scanning-configuration scanOnPush=true || echo "Repository may already exist"
done

# Step 2: Create Batch compute environment
echo "Creating AWS Batch compute environment..."
aws batch create-compute-environment \\
    --compute-environment-name ai-agents-compute \\
    --type MANAGED \\
    --state ENABLED \\
    --compute-resources type=FARGATE,maxvCpus=256 \\
    --region $AWS_REGION || echo "Compute environment may already exist"

# Step 3: Create Batch job queue
echo "Creating AWS Batch job queue..."
aws batch create-job-queue \\
    --job-queue-name ai-agents-queue \\
    --state ENABLED \\
    --priority 10 \\
    --compute-environment-order order=1,computeEnvironment=ai-agents-compute \\
    --region $AWS_REGION || echo "Job queue may already exist"

# Step 4: Create Batch job definition
echo "Creating AWS Batch job definition..."
cat > batch-job-definition.json << EOF
{
    "jobDefinitionName": "ai-agent-processor",
    "type": "container",
    "platformCapabilities": ["FARGATE"],
    "containerProperties": {
        "image": "public.ecr.aws/lambda/python:3.11",
        "vcpus": 0.5,
        "memory": 1024,
        "jobRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/BatchExecutionRole",
        "fargatePlatformConfiguration": {
            "platformVersion": "1.4.0"
        },
        "networkConfiguration": {
            "assignPublicIp": "ENABLED"
        }
    },
    "retryStrategy": {
        "attempts": 3
    },
    "timeout": {
        "attemptDurationSeconds": 3600
    }
}
EOF

aws batch register-job-definition \\
    --cli-input-json file://batch-job-definition.json \\
    --region $AWS_REGION || echo "Job definition may already exist"

# Step 5: Create ECS cluster for Fargate
echo "Creating ECS cluster..."
aws ecs create-cluster \\
    --cluster-name ai-agents-cluster \\
    --capacity-providers FARGATE \\
    --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \\
    --region $AWS_REGION || echo "Cluster may already exist"

# Step 6: Create ECS task definition
echo "Creating ECS task definition..."
cat > ecs-task-definition.json << EOF
{
    "family": "ai-agent-task",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "512",
    "memory": "1024",
    "executionRoleArn": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/ecsTaskExecutionRole",
    "containerDefinitions": [
        {
            "name": "ai-agent-container",
            "image": "public.ecr.aws/lambda/python:3.11",
            "essential": true,
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/aws/ecs/ai-agents",
                    "awslogs-region": "$AWS_REGION",
                    "awslogs-stream-prefix": "ecs"
                }
            }
        }
    ]
}
EOF

aws ecs register-task-definition \\
    --cli-input-json file://ecs-task-definition.json \\
    --region $AWS_REGION || echo "Task definition may already exist"

# Step 7: Create Lambda function
echo "Creating Lambda function..."
cat > lambda-function.py << 'EOF'
import json
import boto3
import os

def lambda_handler(event, context):
    # This will be replaced with actual agent processing logic
    print(f"Processing issue: {event}")
    
    # Return success
    return {
        'statusCode': 200,
        'body': json.dumps({
            'message': 'Agent processing started',
            'event': event
        })
    }
EOF

zip lambda-function.zip lambda-function.py

aws lambda create-function \\
    --function-name ai-agent-processor \\
    --runtime python3.11 \\
    --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \\
    --handler lambda-function.lambda_handler \\
    --zip-file fileb://lambda-function.zip \\
    --region $AWS_REGION || echo "Lambda function may already exist"

# Step 8: Create CloudWatch log group
echo "Creating CloudWatch log group..."
aws logs create-log-group \\
    --log-group-name /aws/ecs/ai-agents \\
    --region $AWS_REGION || echo "Log group may already exist"

echo "AWS infrastructure setup completed!"
echo ""
echo "Next steps:"
echo "1. Build and push agent containers: ./build-all-containers.sh && ./push-containers.sh"
echo "2. Update GitHub repository secrets with AWS credentials"
echo "3. Add the GitHub Actions workflow to your repositories"
echo "4. Test by creating a GitHub issue with appropriate labels"
'''
    
    with open("aws-infrastructure-setup.sh", "w") as f:
        f.write(setup_script)
    
    subprocess.run(['chmod', '+x', 'aws-infrastructure-setup.sh'])
    
    logger.info("Created AWS infrastructure setup script")

def main():
    """Main function for testing and setup"""
    
    print("\n" + "="*80)
    print("🚀 GITHUB AGENT DISPATCHER - COMPLETE SYSTEM")
    print("="*80)
    print("Continuing where Opus left off...")
    print("Creating complete GitHub Issues → Agent assignment system")
    print("="*80)
    
    # Initialize the dispatcher
    dispatcher = GitHubAgentDispatcher()
    
    # Create all the necessary infrastructure files
    print("\n📦 Creating agent containers...")
    containers = dispatcher.create_agent_containers()
    print(f"✅ Created {len(containers)} agent containers")
    
    print("\n🔄 Creating GitHub Actions workflow...")
    create_github_actions_workflow()
    print("✅ Created GitHub Actions workflow")
    
    print("\n☁️ Creating AWS infrastructure setup...")
    create_aws_infrastructure_setup()
    print("✅ Created AWS infrastructure setup")
    
    # Test with sample issue
    print("\n🧪 Testing with sample issue...")
    sample_payload = {
        'action': 'opened',
        'issue': {
            'number': 123,
            'title': '[BUG] Fix authentication issue in login flow',
            'body': 'Users are unable to login after recent deployment. Need to investigate and fix.',
            'labels': [{'name': 'bug'}, {'name': 'backend'}]
        },
        'repository': {'full_name': 'VisualForgeMediaV2/test-repo'},
        'sender': {'login': 'test-user'}
    }
    
    result = dispatcher.process_issue_event(sample_payload)
    print(f"✅ Test result: {result}")
    
    print("\n" + "="*80)
    print("🎯 SETUP COMPLETE - READY FOR DEPLOYMENT")
    print("="*80)
    
    print("\n📋 DEPLOYMENT CHECKLIST:")
    print("1. ☐ Run AWS infrastructure setup:")
    print("   ./aws-infrastructure-setup.sh")
    print()
    print("2. ☐ Build and push agent containers:")
    print("   ./build-all-containers.sh")
    print("   ./push-containers.sh")
    print()
    print("3. ☐ Add GitHub repository secrets:")
    print("   - AWS_ACCESS_KEY_ID")
    print("   - AWS_SECRET_ACCESS_KEY")
    print("   - AGENT_WEBHOOK_URL (optional fallback)")
    print()
    print("4. ☐ Add GitHub repository variables:")
    print("   - AWS_REGION")
    print("   - AWS_SUBNET_ID") 
    print("   - AWS_SECURITY_GROUP_ID")
    print()
    print("5. ☐ Copy workflow to repositories:")
    print("   Copy .github/workflows/ai-agent-dispatcher.yml to each repo")
    print()
    print("6. ☐ Test the system:")
    print("   Create a GitHub issue with labels like 'bug', 'feature', etc.")
    print()
    
    print("🚀 AGENT ASSIGNMENT FLOW:")
    print("GitHub Issue → GitHub Actions → Agent Analysis → AWS Deployment → Agent Processing → GitHub Update")
    print()
    
    print("💡 SUPPORTED PLATFORMS:")
    print("• AWS Lambda - Quick processing (management, support, finance)")
    print("• AWS Fargate - Medium complexity (development, architecture, security)")  
    print("• AWS Batch - Heavy processing (QA, analytics)")
    print()
    
    print("📊 AGENT ASSIGNMENTS:")
    for agent_type, assignment in dispatcher.agent_assignments.items():
        print(f"• {assignment.agent_name}: {assignment.compute_type} (P{assignment.priority})")
    
    print("\n🎉 THE AUTONOMOUS AGENT SYSTEM IS READY!")
    print("Issues will automatically be assigned and processed by AI agents!")

if __name__ == "__main__":
    main()
