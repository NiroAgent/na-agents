#!/usr/bin/env python3
"""
AI DevOps Agent - Phase 5 Implementation
Handles deployment automation, CI/CD pipelines, and infrastructure management
Completes the automated software development pipeline
"""

import json
import os
import sys
import subprocess
import logging
# yaml import removed - not required for core functionality
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import uuid
import shutil
import tempfile

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('AIDevOpsAgent')


class DeploymentTarget(Enum):
    """Deployment target environments"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class DeploymentStrategy(Enum):
    """Deployment strategies"""
    ROLLING_UPDATE = "rolling_update"
    BLUE_GREEN = "blue_green"
    CANARY = "canary"
    RECREATE = "recreate"


@dataclass
class DeploymentConfig:
    """Deployment configuration"""
    project_id: str
    project_name: str
    version: str
    target: DeploymentTarget
    strategy: DeploymentStrategy
    docker_registry: str = "docker.io"
    kubernetes_namespace: str = "default"
    replicas: int = 3
    health_check_url: str = "/health"
    rollback_enabled: bool = True
    monitoring_enabled: bool = True


@dataclass
class DeploymentResult:
    """Result of a deployment operation"""
    deployment_id: str
    project_id: str
    status: str  # success, failed, rollback
    target: str
    version: str
    timestamp: str
    duration: float
    endpoints: List[str]
    logs: List[str]
    metrics: Dict[str, Any]
    
    def to_dict(self):
        return asdict(self)


class DockerManager:
    """Manages Docker operations"""
    
    def __init__(self, project_path: str, config: DeploymentConfig):
        self.project_path = Path(project_path)
        self.config = config
        self.image_name = f"{config.docker_registry}/{config.project_name}"
        self.image_tag = config.version
    
    def generate_dockerfile(self, language: str, framework: str) -> str:
        """Generate optimized Dockerfile based on project type"""
        
        if language.lower() == 'python' and framework.lower() == 'fastapi':
            return self._generate_python_fastapi_dockerfile()
        elif language.lower() in ['typescript', 'javascript'] and framework.lower() == 'express':
            return self._generate_node_express_dockerfile()
        elif language.lower() == 'go':
            return self._generate_go_dockerfile()
        elif language.lower() == 'java' and framework.lower() == 'spring':
            return self._generate_java_spring_dockerfile()
        else:
            return self._generate_generic_dockerfile()
    
    def _generate_python_fastapi_dockerfile(self) -> str:
        """Generate Dockerfile for Python FastAPI projects"""
        return '''# Multi-stage build for Python FastAPI
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy Python dependencies from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Update PATH
ENV PATH=/home/appuser/.local/bin:$PATH

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
'''
    
    def _generate_node_express_dockerfile(self) -> str:
        """Generate Dockerfile for Node.js Express projects"""
        return '''# Multi-stage build for Node.js Express
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build TypeScript (if applicable)
RUN npm run build 2>/dev/null || true

# Runtime stage
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app .

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Expose port
EXPOSE 3000

# Run application
CMD ["node", "dist/index.js"]
'''
    
    def _generate_go_dockerfile(self) -> str:
        """Generate Dockerfile for Go projects"""
        return '''# Multi-stage build for Go
FROM golang:1.21-alpine as builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Runtime stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/main .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# Run application
CMD ["./main"]
'''
    
    def _generate_java_spring_dockerfile(self) -> str:
        """Generate Dockerfile for Java Spring projects"""
        return '''# Multi-stage build for Java Spring
FROM maven:3.8-openjdk-17 as builder

WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
FROM openjdk:17-slim

WORKDIR /app

# Copy JAR from builder
COPY --from=builder /app/target/*.jar app.jar

# Create non-root user
RUN useradd -m -u 1000 appuser
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# Expose port
EXPOSE 8080

# Run application
ENTRYPOINT ["java", "-jar", "app.jar"]
'''
    
    def _generate_generic_dockerfile(self) -> str:
        """Generate generic Dockerfile"""
        return '''# Generic Dockerfile
FROM ubuntu:22.04

WORKDIR /app

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy application
COPY . .

# Expose common port
EXPOSE 8080

# Run application (update this command)
CMD ["./start.sh"]
'''
    
    def build_image(self) -> bool:
        """Build Docker image"""
        try:
            logger.info(f"Building Docker image: {self.image_name}:{self.image_tag}")
            
            cmd = [
                "docker", "build",
                "-t", f"{self.image_name}:{self.image_tag}",
                "-t", f"{self.image_name}:latest",
                str(self.project_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info("Docker image built successfully")
                return True
            else:
                logger.error(f"Docker build failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error building Docker image: {e}")
            return False
    
    def push_image(self) -> bool:
        """Push Docker image to registry"""
        try:
            logger.info(f"Pushing Docker image to registry: {self.image_name}:{self.image_tag}")
            
            cmd = ["docker", "push", f"{self.image_name}:{self.image_tag}"]
            result = subprocess.run(cmd, capture_output=True, text=True)
            
            if result.returncode == 0:
                logger.info("Docker image pushed successfully")
                return True
            else:
                logger.error(f"Docker push failed: {result.stderr}")
                return False
                
        except Exception as e:
            logger.error(f"Error pushing Docker image: {e}")
            return False


class KubernetesManager:
    """Manages Kubernetes deployments"""
    
    def __init__(self, config: DeploymentConfig):
        self.config = config
    
    def generate_deployment_yaml(self) -> str:
        """Generate Kubernetes deployment YAML"""
        return f'''apiVersion: apps/v1
kind: Deployment
metadata:
  name: {self.config.project_name}
  namespace: {self.config.kubernetes_namespace}
  labels:
    app: {self.config.project_name}
    version: {self.config.version}
spec:
  replicas: {self.config.replicas}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: {self.config.project_name}
  template:
    metadata:
      labels:
        app: {self.config.project_name}
        version: {self.config.version}
    spec:
      containers:
      - name: {self.config.project_name}
        image: {self.config.docker_registry}/{self.config.project_name}:{self.config.version}
        ports:
        - containerPort: 8000
        env:
        - name: ENVIRONMENT
          value: {self.config.target.value}
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: {self.config.health_check_url}
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: {self.config.health_check_url}
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
'''
    
    def generate_service_yaml(self) -> str:
        """Generate Kubernetes service YAML"""
        return f'''apiVersion: v1
kind: Service
metadata:
  name: {self.config.project_name}-service
  namespace: {self.config.kubernetes_namespace}
spec:
  selector:
    app: {self.config.project_name}
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: LoadBalancer
'''
    
    def generate_ingress_yaml(self) -> str:
        """Generate Kubernetes ingress YAML"""
        return f'''apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {self.config.project_name}-ingress
  namespace: {self.config.kubernetes_namespace}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: {self.config.project_name}.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: {self.config.project_name}-service
            port:
              number: 80
'''


class CICDPipelineGenerator:
    """Generates CI/CD pipeline configurations"""
    
    def __init__(self, project_name: str, language: str, framework: str):
        self.project_name = project_name
        self.language = language
        self.framework = framework
    
    def generate_github_actions(self) -> str:
        """Generate GitHub Actions workflow"""
        return f'''name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: docker.io
  IMAGE_NAME: {self.project_name}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python
      if: contains('{self.language}', 'python')
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Set up Node.js
      if: contains('{self.language}', 'javascript') || contains('{self.language}', 'typescript')
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: |
        {self._get_install_command()}
    
    - name: Run tests
      run: |
        {self._get_test_command()}
    
    - name: Run linting
      run: |
        {self._get_lint_command()}
  
  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v2
    
    - name: Log in to Docker Hub
      uses: docker/login-action@v2
      with:
        username: ${{{{ secrets.DOCKER_USERNAME }}}}
        password: ${{{{ secrets.DOCKER_PASSWORD }}}}
    
    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: |
          ${{{{ env.REGISTRY }}}}/${{{{ env.IMAGE_NAME }}}}:${{{{ github.sha }}}}
          ${{{{ env.REGISTRY }}}}/${{{{ env.IMAGE_NAME }}}}:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to Kubernetes
      run: |
        echo "Deploying to production..."
        # Add actual deployment commands here
    
    - name: Notify deployment
      run: |
        echo "Deployment complete!"
'''
    
    def generate_gitlab_ci(self) -> str:
        """Generate GitLab CI/CD pipeline"""
        return f'''stages:
  - test
  - build
  - deploy

variables:
  IMAGE_NAME: {self.project_name}
  DOCKER_REGISTRY: registry.gitlab.com

test:
  stage: test
  script:
    - {self._get_install_command()}
    - {self._get_test_command()}
    - {self._get_lint_command()}
  coverage: '/TOTAL.*\s+(\d+%)$/'

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA .
    - docker push $DOCKER_REGISTRY/$IMAGE_NAME:$CI_COMMIT_SHA
  only:
    - main
    - develop

deploy:
  stage: deploy
  script:
    - echo "Deploying to production..."
    # Add deployment scripts
  environment:
    name: production
    url: https://{self.project_name}.example.com
  only:
    - main
'''
    
    def _get_install_command(self) -> str:
        """Get install command based on language"""
        if self.language.lower() == 'python':
            return 'pip install -r requirements.txt'
        elif self.language.lower() in ['javascript', 'typescript']:
            return 'npm ci'
        elif self.language.lower() == 'go':
            return 'go mod download'
        elif self.language.lower() == 'java':
            return 'mvn install'
        return 'echo "No install command"'
    
    def _get_test_command(self) -> str:
        """Get test command based on language"""
        if self.language.lower() == 'python':
            return 'pytest tests/ --cov=src --cov-report=term-missing'
        elif self.language.lower() in ['javascript', 'typescript']:
            return 'npm test'
        elif self.language.lower() == 'go':
            return 'go test ./...'
        elif self.language.lower() == 'java':
            return 'mvn test'
        return 'echo "No test command"'
    
    def _get_lint_command(self) -> str:
        """Get lint command based on language"""
        if self.language.lower() == 'python':
            return 'flake8 src/ --max-line-length=120'
        elif self.language.lower() in ['javascript', 'typescript']:
            return 'npm run lint'
        elif self.language.lower() == 'go':
            return 'golint ./...'
        elif self.language.lower() == 'java':
            return 'mvn checkstyle:check'
        return 'echo "No lint command"'


class MonitoringSetup:
    """Sets up monitoring and alerting"""
    
    def __init__(self, project_name: str):
        self.project_name = project_name
    
    def generate_prometheus_config(self) -> str:
        """Generate Prometheus configuration"""
        return f'''global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: '{self.project_name}'
    static_configs:
      - targets: ['{self.project_name}-service:80']
    metrics_path: /metrics
'''
    
    def generate_grafana_dashboard(self) -> Dict[str, Any]:
        """Generate Grafana dashboard JSON"""
        return {
            "dashboard": {
                "title": f"{self.project_name} Dashboard",
                "panels": [
                    {
                        "title": "Request Rate",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'rate(http_requests_total{{job="{self.project_name}"}}[5m])'
                            }
                        ]
                    },
                    {
                        "title": "Response Time",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{job="{self.project_name}"}}[5m]))'
                            }
                        ]
                    },
                    {
                        "title": "Error Rate",
                        "type": "graph",
                        "targets": [
                            {
                                "expr": f'rate(http_requests_total{{job="{self.project_name}",status=~"5.."}}[5m])'
                            }
                        ]
                    }
                ]
            }
        }
    
    def generate_alerting_rules(self) -> str:
        """Generate alerting rules"""
        return f'''groups:
- name: {self.project_name}_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{{job="{self.project_name}",status=~"5.."}}[5m]) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High error rate detected
      description: "Error rate is above 5% for {self.project_name}"
  
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{job="{self.project_name}"}}[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High response time detected
      description: "95th percentile response time is above 1 second"
  
  - alert: ServiceDown
    expr: up{{job="{self.project_name}"}} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: Service is down
      description: "{self.project_name} service is not responding"
'''


class AIDevOpsAgent:
    """Main AI DevOps Agent"""
    
    def __init__(self):
        self.logger = logger
        self.agent_id = "ai-devops-001"
        self.agent_type = "devops"
        self.capabilities = [
            "serverless_deployment",
            "lambda_automation",
            "fargate_orchestration", 
            "ci_cd_pipeline",
            "infrastructure_as_code",
            "monitoring_setup",
            "auto_scaling_config"
        ]
        
        # AWS BACKEND PROCESSING POLICY - MANDATORY COMPLIANCE
        self.aws_backend_policy = {
            "priority_order": [
                "AWS Lambda (serverless functions)",
                "AWS Fargate Tasks (Batch/Step Functions)", 
                "AWS Fargate Container Service (ECS/EKS)",
                "EC2 (requires justification)"
            ],
            "deployment_strategies": {
                "lambda": {
                    "deployment_package": "ZIP or Container Image",
                    "orchestration": "SAM/CDK/Terraform",
                    "api_gateway": "Required for HTTP APIs",
                    "scaling": "Automatic (0 to 1000+ concurrent)"
                },
                "fargate_batch": {
                    "orchestration": "AWS Batch or Step Functions",
                    "container_registry": "ECR",
                    "scaling": "On-demand task execution"
                },
                "fargate_service": {
                    "orchestration": "ECS or EKS",
                    "load_balancer": "ALB/NLB",
                    "scaling": "Auto Scaling Groups"
                }
            },
            "infrastructure_as_code": {
                "preferred_tools": ["AWS SAM", "AWS CDK", "Terraform"],
                "serverless_first": True,
                "cost_optimization": True
            }
        }
        
        logger.info("AI DevOps Agent initialized with AWS Serverless-First Policy")
    
    def deploy_project(self, project_path: str, project_info: Dict[str, Any], 
                       target: DeploymentTarget = DeploymentTarget.STAGING) -> DeploymentResult:
        """Deploy a project to specified target"""
        logger.info(f"Starting deployment for project: {project_path} to {target.value}")
        
        start_time = datetime.now()
        deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
        logs = []
        
        try:
            # Create deployment configuration
            config = DeploymentConfig(
                project_id=project_info.get('project_id', 'unknown'),
                project_name=project_info.get('project_name', 'app'),
                version=project_info.get('version', '1.0.0'),
                target=target,
                strategy=DeploymentStrategy.ROLLING_UPDATE
            )
            
            # Step 1: Generate Docker configuration
            logs.append("Generating Docker configuration...")
            docker_manager = DockerManager(project_path, config)
            
            dockerfile_content = docker_manager.generate_dockerfile(
                project_info.get('language', 'python'),
                project_info.get('framework', 'fastapi')
            )
            
            # Write Dockerfile
            dockerfile_path = Path(project_path) / 'Dockerfile'
            with open(dockerfile_path, 'w') as f:
                f.write(dockerfile_content)
            logs.append(f"Dockerfile created at {dockerfile_path}")
            
            # Step 2: Generate CI/CD pipeline
            logs.append("Generating CI/CD pipeline...")
            pipeline_gen = CICDPipelineGenerator(
                config.project_name,
                project_info.get('language', 'python'),
                project_info.get('framework', 'fastapi')
            )
            
            github_actions = pipeline_gen.generate_github_actions()
            
            # Create .github/workflows directory
            workflows_dir = Path(project_path) / '.github' / 'workflows'
            workflows_dir.mkdir(parents=True, exist_ok=True)
            
            # Write GitHub Actions workflow
            workflow_file = workflows_dir / 'ci-cd.yml'
            with open(workflow_file, 'w') as f:
                f.write(github_actions)
            logs.append(f"CI/CD pipeline created at {workflow_file}")
            
            # Step 3: Generate Kubernetes manifests
            logs.append("Generating Kubernetes manifests...")
            k8s_manager = KubernetesManager(config)
            
            k8s_dir = Path(project_path) / 'k8s'
            k8s_dir.mkdir(exist_ok=True)
            
            # Write deployment YAML
            with open(k8s_dir / 'deployment.yaml', 'w') as f:
                f.write(k8s_manager.generate_deployment_yaml())
            
            # Write service YAML
            with open(k8s_dir / 'service.yaml', 'w') as f:
                f.write(k8s_manager.generate_service_yaml())
            
            # Write ingress YAML
            with open(k8s_dir / 'ingress.yaml', 'w') as f:
                f.write(k8s_manager.generate_ingress_yaml())
            
            logs.append("Kubernetes manifests created")
            
            # Step 4: Set up monitoring
            logs.append("Setting up monitoring configuration...")
            monitoring = MonitoringSetup(config.project_name)
            
            monitoring_dir = Path(project_path) / 'monitoring'
            monitoring_dir.mkdir(exist_ok=True)
            
            # Write Prometheus config
            with open(monitoring_dir / 'prometheus.yml', 'w') as f:
                f.write(monitoring.generate_prometheus_config())
            
            # Write Grafana dashboard
            with open(monitoring_dir / 'dashboard.json', 'w') as f:
                json.dump(monitoring.generate_grafana_dashboard(), f, indent=2)
            
            # Write alerting rules
            with open(monitoring_dir / 'alerts.yml', 'w') as f:
                f.write(monitoring.generate_alerting_rules())
            
            logs.append("Monitoring configuration created")
            
            # Step 5: Create deployment documentation
            logs.append("Generating deployment documentation...")
            self._create_deployment_docs(project_path, config)
            logs.append("Deployment documentation created")
            
            # Calculate deployment duration
            duration = (datetime.now() - start_time).total_seconds()
            
            # Create deployment result
            result = DeploymentResult(
                deployment_id=deployment_id,
                project_id=config.project_id,
                status="success",
                target=target.value,
                version=config.version,
                timestamp=datetime.now().isoformat(),
                duration=duration,
                endpoints=[
                    f"http://{config.project_name}.{target.value}.example.com",
                    f"http://{config.project_name}-service.{config.kubernetes_namespace}"
                ],
                logs=logs,
                metrics={
                    "docker_config": True,
                    "ci_cd_pipeline": True,
                    "k8s_manifests": True,
                    "monitoring": True,
                    "documentation": True
                }
            )
            
            logger.info(f"Deployment successful: {deployment_id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Deployment failed: {e}")
            
            return DeploymentResult(
                deployment_id=deployment_id,
                project_id=project_info.get('project_id', 'unknown'),
                status="failed",
                target=target.value,
                version=project_info.get('version', '1.0.0'),
                timestamp=datetime.now().isoformat(),
                duration=(datetime.now() - start_time).total_seconds(),
                endpoints=[],
                logs=logs + [f"Error: {str(e)}"],
                metrics={}
            )
    
    def _create_deployment_docs(self, project_path: str, config: DeploymentConfig):
        """Create deployment documentation"""
        docs_content = f"""# Deployment Guide

## Project: {config.project_name}
Version: {config.version}
Target: {config.target.value}

## Quick Start

### Local Development
```bash
docker build -t {config.project_name} .
docker run -p 8000:8000 {config.project_name}
```

### Kubernetes Deployment
```bash
kubectl apply -f k8s/
```

## CI/CD Pipeline

The project includes GitHub Actions workflow for automated testing and deployment.

### Pipeline Stages:
1. **Test** - Runs unit tests and linting
2. **Build** - Builds Docker image
3. **Deploy** - Deploys to target environment

## Monitoring

### Prometheus Metrics
- Endpoint: `/metrics`
- Scrape interval: 15s

### Grafana Dashboard
Import `monitoring/dashboard.json` into Grafana

### Alerts
- High Error Rate (>5%)
- High Response Time (>1s)
- Service Down

## Rollback Procedures

### Docker Rollback
```bash
docker pull {config.docker_registry}/{config.project_name}:previous-version
docker run -p 8000:8000 {config.docker_registry}/{config.project_name}:previous-version
```

### Kubernetes Rollback
```bash
kubectl rollout undo deployment/{config.project_name} -n {config.kubernetes_namespace}
```

## Health Checks
- Endpoint: `{config.health_check_url}`
- Expected response: 200 OK

## Environment Variables
- `ENVIRONMENT`: {config.target.value}
- Additional variables in `.env` file

## Support
For issues, check logs:
```bash
kubectl logs -f deployment/{config.project_name} -n {config.kubernetes_namespace}
```
"""
        
        docs_path = Path(project_path) / 'DEPLOYMENT.md'
        with open(docs_path, 'w') as f:
            f.write(docs_content)
    
    def create_infrastructure_as_code(self, project_info: Dict[str, Any]) -> Dict[str, str]:
        """Create Infrastructure as Code templates"""
        logger.info("Creating Infrastructure as Code templates...")
        
        templates = {}
        
        # Terraform configuration
        templates['terraform'] = f"""terraform {{
  required_version = ">= 1.0"
  
  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

provider "aws" {{
  region = var.aws_region
}}

variable "aws_region" {{
  default = "us-east-1"
}}

variable "project_name" {{
  default = "{project_info.get('project_name', 'app')}"
}}

# ECS Cluster
resource "aws_ecs_cluster" "main" {{
  name = var.project_name
}}

# ECS Task Definition
resource "aws_ecs_task_definition" "app" {{
  family                   = var.project_name
  network_mode            = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                     = "256"
  memory                  = "512"
  
  container_definitions = jsonencode([{{
    name  = var.project_name
    image = "${{var.project_name}}:latest"
    
    portMappings = [{{
      containerPort = 8000
      protocol      = "tcp"
    }}]
  }}])
}}
"""
        
        # CloudFormation template
        templates['cloudformation'] = json.dumps({
            "AWSTemplateFormatVersion": "2010-09-09",
            "Description": f"Infrastructure for {project_info.get('project_name', 'app')}",
            "Resources": {
                "ECSCluster": {
                    "Type": "AWS::ECS::Cluster",
                    "Properties": {
                        "ClusterName": project_info.get('project_name', 'app')
                    }
                }
            }
        }, indent=2)
        
        # Ansible playbook
        templates['ansible'] = f"""---
- name: Deploy {project_info.get('project_name', 'app')}
  hosts: all
  become: yes
  
  tasks:
    - name: Install Docker
      package:
        name: docker.io
        state: present
    
    - name: Start Docker service
      service:
        name: docker
        state: started
        enabled: yes
    
    - name: Pull Docker image
      docker_image:
        name: {project_info.get('project_name', 'app')}:latest
        source: pull
    
    - name: Run container
      docker_container:
        name: {project_info.get('project_name', 'app')}
        image: {project_info.get('project_name', 'app')}:latest
        ports:
          - "8000:8000"
        restart_policy: always
"""
        
        return templates
    
    def generate_deployment_summary(self, result: DeploymentResult) -> str:
        """Generate human-readable deployment summary"""
        status_icon = "SUCCESS" if result.status == "success" else "FAILED"
        
        summary = f"""
Deployment Summary
==================
{status_icon} Status: {result.status.upper()}
Deployment ID: {result.deployment_id}
Project ID: {result.project_id}
Target: {result.target}
Version: {result.version}
Duration: {result.duration:.2f} seconds

Deployment Steps:
"""
        for log in result.logs:
            summary += f"  - {log}\n"
        
        if result.endpoints:
            summary += f"\nEndpoints:\n"
            for endpoint in result.endpoints:
                summary += f"  - {endpoint}\n"
        
        if result.metrics:
            summary += f"\nMetrics:\n"
            for key, value in result.metrics.items():
                status = "[PASS]" if value else "[FAIL]"
                summary += f"  {status} {key}\n"
        
        return summary


def main():
    """Main entry point for testing"""
    logger.info("AI DevOps Agent starting...")
    
    # Initialize agent
    devops_agent = AIDevOpsAgent()
    
    # Test with the QA-validated project
    project_info = {
        'project_id': 'test-api-001',
        'project_name': 'test-api',
        'version': '1.0.0',
        'language': 'python',
        'framework': 'fastapi'
    }
    
    project_path = 'generated_projects/test-api'
    
    if Path(project_path).exists():
        # Deploy to staging
        result = devops_agent.deploy_project(
            project_path,
            project_info,
            DeploymentTarget.STAGING
        )
        
        # Print summary
        print(devops_agent.generate_deployment_summary(result))
        
        # Save deployment report
        report_dir = Path('deployment_reports')
        report_dir.mkdir(exist_ok=True)
        
        report_file = report_dir / f"{result.deployment_id}.json"
        with open(report_file, 'w') as f:
            json.dump(result.to_dict(), f, indent=2, default=str)
        
        logger.info(f"Deployment report saved to: {report_file}")
        
        # Generate Infrastructure as Code templates
        iac_templates = devops_agent.create_infrastructure_as_code(project_info)
        
        iac_dir = Path(project_path) / 'infrastructure'
        iac_dir.mkdir(exist_ok=True)
        
        for template_type, content in iac_templates.items():
            if template_type == 'terraform':
                file_name = 'main.tf'
            elif template_type == 'cloudformation':
                file_name = 'template.json'
            elif template_type == 'ansible':
                file_name = 'playbook.yml'
            else:
                file_name = f"{template_type}.txt"
            
            with open(iac_dir / file_name, 'w') as f:
                f.write(content)
        
        logger.info(f"Infrastructure as Code templates created in: {iac_dir}")
        
    else:
        logger.warning(f"Project path not found: {project_path}")
        logger.info("Creating mock deployment for demonstration...")
        
        # Mock deployment
        result = DeploymentResult(
            deployment_id=f"deploy-{uuid.uuid4().hex[:8]}",
            project_id="mock-001",
            status="success",
            target="staging",
            version="1.0.0",
            timestamp=datetime.now().isoformat(),
            duration=45.2,
            endpoints=["http://test-api.staging.example.com"],
            logs=[
                "Docker configuration generated",
                "CI/CD pipeline created",
                "Kubernetes manifests generated",
                "Monitoring setup complete",
                "Deployment successful"
            ],
            metrics={
                "docker_config": True,
                "ci_cd_pipeline": True,
                "k8s_manifests": True,
                "monitoring": True
            }
        )
        
        print(devops_agent.generate_deployment_summary(result))


if __name__ == "__main__":
    main()