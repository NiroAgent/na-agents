#!/usr/bin/env python3
"""
AI Architect Agent - Technical Design and Architecture Decisions
Receives work from PM Workflow and creates detailed technical specifications
for the AI Developer Agent to implement.
"""

import json
import sys
import time
import re
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from dataclasses import dataclass, asdict
from collections import defaultdict
import hashlib
import threading

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ai_architect_agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('AIArchitectAgent')

# Import existing infrastructure
sys.path.append(str(Path(__file__).parent))

try:
    from team_communication_protocol import CommunicationHub
    from work_queue_manager import WorkQueueManager
    from github_api_service import GitHubAPIService
    logger.info("Successfully imported infrastructure modules")
except ImportError as e:
    logger.warning(f"Import error - using fallback mode: {e}")
    # Fallback implementations for development
    class CommunicationHub:
        def register_agent(self, **kwargs): pass
        def send_message(self, **kwargs): pass
        def update_agent_status(self, **kwargs): pass
    
    class WorkQueueManager:
        def get_work_items(self, **kwargs): return []
        def update_work_item(self, **kwargs): pass
    
    class GitHubAPIService:
        def __init__(self, owner="stevesurles"): pass

@dataclass
class TechnicalSpecification:
    """Complete technical specification for a feature"""
    spec_id: str
    issue_id: str
    title: str
    created_at: str
    requirements: List[Dict[str, Any]]
    architecture: Dict[str, Any]
    api_design: Dict[str, Any]
    database_design: Dict[str, Any]
    technology_stack: Dict[str, List[str]]
    deployment_strategy: Dict[str, Any]
    implementation_roadmap: List[Dict[str, Any]]
    complexity_score: int
    estimated_effort: str
    dependencies: List[str]
    risks: List[Dict[str, str]]

class AIArchitectAgent:
    def __init__(self):
        self.agent_id = "ai-architect-001"
        self.agent_type = "architect"
        self.capabilities = [
            "system_architecture",
            "api_design", 
            "database_design",
            "technology_selection",
            "integration_planning",
            "scalability_analysis",
            "security_architecture",
            "performance_optimization"
        ]
        
        # AWS BACKEND PROCESSING POLICY - MANDATORY COMPLIANCE
        self.aws_backend_policy = {
            "priority_order": [
                "AWS Lambda (serverless functions)",
                "AWS Fargate Tasks (Batch/Step Functions)", 
                "AWS Fargate Container Service (ECS/EKS)",
                "EC2 (requires justification)"
            ],
            "objectives": [
                "Scale to zero when idle",
                "Infinite auto-scaling capability", 
                "Cost optimization - pay for usage only",
                "Minimal infrastructure management"
            ],
            "default_choice": "AWS Lambda",
            "justification_required_for": ["EC2", "Always-on services"]
        }
        
        # Initialize integrations
        self.communication_hub = CommunicationHub()
        self.work_queue = WorkQueueManager()
        self.github_api = GitHubAPIService()
        
        # Specification storage
        self.specifications = {}
        self.active_designs = {}
        
        # Architecture patterns library
        self.architecture_patterns = {
            'serverless_microservices': {
                'description': 'AWS Lambda-based microservices with API Gateway',
                'components': ['API Gateway', 'Lambda Functions', 'DynamoDB', 'S3'],
                'scaling': 'Auto-scale to zero',
                'cost_model': 'Pay per request'
            },
            'fargate_batch': {
                'description': 'Containerized batch processing with Fargate',
                'components': ['AWS Batch', 'Fargate', 'Step Functions', 'S3'],
                'scaling': 'Scale to zero between jobs',
                'cost_model': 'Pay per execution time'
            },
            'microservices': {
                'when_to_use': ['scalability', 'independent_deployment', 'team_autonomy'],
                'components': ['api_gateway', 'service_discovery', 'message_broker'],
                'pros': ['scalability', 'fault_isolation', 'technology_diversity'],
                'cons': ['complexity', 'network_overhead', 'data_consistency']
            },
            'monolithic': {
                'when_to_use': ['simple_application', 'small_team', 'quick_prototype'],
                'components': ['web_server', 'application_server', 'database'],
                'pros': ['simplicity', 'easy_debugging', 'single_deployment'],
                'cons': ['scalability_limits', 'technology_lock', 'deployment_risk']
            },
            'serverless': {
                'when_to_use': ['event_driven', 'variable_load', 'cost_optimization'],
                'components': ['functions', 'api_gateway', 'event_bus'],
                'pros': ['no_infrastructure', 'auto_scaling', 'pay_per_use'],
                'cons': ['vendor_lock', 'cold_starts', 'debugging_complexity']
            },
            'event_driven': {
                'when_to_use': ['real_time', 'async_processing', 'loose_coupling'],
                'components': ['event_bus', 'event_store', 'event_processors'],
                'pros': ['loose_coupling', 'scalability', 'resilience'],
                'cons': ['complexity', 'eventual_consistency', 'debugging']
            }
        }
        
        # Technology recommendations database
        self.tech_recommendations = {
            'frontend': {
                'web': {
                    'react': {'use_cases': ['spa', 'complex_ui', 'large_team'], 'ecosystem': 'excellent'},
                    'vue': {'use_cases': ['progressive', 'simple_ui', 'small_team'], 'ecosystem': 'good'},
                    'angular': {'use_cases': ['enterprise', 'full_framework', 'typescript'], 'ecosystem': 'excellent'},
                    'svelte': {'use_cases': ['performance', 'small_bundle', 'simple'], 'ecosystem': 'growing'}
                },
                'mobile': {
                    'react_native': {'use_cases': ['cross_platform', 'react_team'], 'ecosystem': 'excellent'},
                    'flutter': {'use_cases': ['cross_platform', 'performance'], 'ecosystem': 'good'},
                    'native': {'use_cases': ['platform_specific', 'performance'], 'ecosystem': 'excellent'}
                }
            },
            'backend': {
                'nodejs': {'use_cases': ['real_time', 'api', 'microservices'], 'performance': 'good'},
                'python': {'use_cases': ['ml', 'data_processing', 'rapid_development'], 'performance': 'moderate'},
                'go': {'use_cases': ['performance', 'concurrent', 'microservices'], 'performance': 'excellent'},
                'java': {'use_cases': ['enterprise', 'spring', 'robust'], 'performance': 'good'},
                'rust': {'use_cases': ['systems', 'performance', 'safety'], 'performance': 'excellent'}
            },
            'database': {
                'postgresql': {'type': 'relational', 'use_cases': ['complex_queries', 'acid', 'json']},
                'mongodb': {'type': 'document', 'use_cases': ['flexible_schema', 'scalability']},
                'redis': {'type': 'key_value', 'use_cases': ['caching', 'sessions', 'pub_sub']},
                'elasticsearch': {'type': 'search', 'use_cases': ['full_text', 'analytics', 'logs']},
                'cassandra': {'type': 'wide_column', 'use_cases': ['time_series', 'high_write']}
            }
        }
        
        # API design patterns
        self.api_patterns = {
            'rest': {'use_cases': ['crud', 'resources', 'standard'], 'complexity': 'low'},
            'graphql': {'use_cases': ['flexible_queries', 'mobile', 'aggregation'], 'complexity': 'medium'},
            'grpc': {'use_cases': ['microservices', 'performance', 'streaming'], 'complexity': 'medium'},
            'websocket': {'use_cases': ['real_time', 'bidirectional', 'push'], 'complexity': 'medium'},
            'webhook': {'use_cases': ['events', 'integration', 'async'], 'complexity': 'low'}
        }
        
        # Metrics
        self.metrics = {
            'specifications_created': 0,
            'total_complexity_score': 0,
            'architecture_patterns_used': defaultdict(int),
            'technology_recommendations': defaultdict(int),
            'avg_processing_time': 0,
            'processing_times': []
        }
        
        # Register agent
        self.register_agent()
        
    def register_agent(self):
        """Register this agent with the communication hub"""
        try:
            self.communication_hub.register_agent(
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                capabilities=self.capabilities,
                status="active",
                resources={"cpu": 0.5, "memory": "1GB"}
            )
            logger.info("AI Architect Agent registered successfully")
        except Exception as e:
            logger.error(f"Registration failed: {e}")
    
    def analyze_github_issue(self, issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze GitHub issue and extract technical requirements
        
        Args:
            issue_data: GitHub issue with title, body, labels, etc.
            
        Returns:
            Technical analysis with architecture recommendations
        """
        start_time = datetime.now()
        
        issue_title = issue_data.get('title', '')
        issue_body = issue_data.get('body', '')
        labels = issue_data.get('labels', [])
        
        # Extract technical requirements
        requirements = self.extract_requirements(issue_title, issue_body)
        
        # Analyze context and constraints
        context = self.analyze_context(issue_data)
        
        # Determine technical approach
        tech_approach = self.determine_technical_approach(requirements, labels, context)
        
        # Choose technology stack
        tech_stack = self.recommend_technology_stack(requirements, tech_approach, context)
        
        # Identify risks and dependencies
        risks = self.identify_risks(requirements, tech_approach)
        dependencies = self.identify_dependencies(requirements, tech_stack)
        
        # Calculate metrics
        complexity = self.calculate_complexity(requirements, tech_approach, dependencies)
        effort = self.estimate_effort(requirements, tech_approach, complexity)
        
        # Track processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        self.metrics['processing_times'].append(processing_time)
        self.metrics['avg_processing_time'] = sum(self.metrics['processing_times']) / len(self.metrics['processing_times'])
        
        return {
            'issue_id': issue_data.get('id'),
            'title': issue_title,
            'requirements': requirements,
            'context': context,
            'technical_approach': tech_approach,
            'technology_stack': tech_stack,
            'complexity_score': complexity,
            'estimated_effort': effort,
            'risks': risks,
            'dependencies': dependencies
        }
    
    def extract_requirements(self, title: str, body: str) -> List[Dict[str, Any]]:
        """Extract structured requirements from issue text"""
        requirements = []
        
        # Functional requirements patterns
        functional_patterns = [
            (r"user should be able to (.+)", 'functional', 'user_capability'),
            (r"system must (.+)", 'functional', 'system_requirement'),
            (r"application needs to (.+)", 'functional', 'application_requirement'),
            (r"feature requires (.+)", 'functional', 'feature_requirement'),
            (r"support for (.+)", 'functional', 'support_requirement'),
            (r"enable (.+)", 'functional', 'enablement')
        ]
        
        # Non-functional requirements patterns  
        nonfunctional_patterns = [
            (r"performance[:\s]+(.+)", 'performance', 'metric'),
            (r"should handle (\d+) requests?", 'performance', 'throughput'),
            (r"response time[:\s]+(.+)", 'performance', 'latency'),
            (r"security[:\s]+(.+)", 'security', 'requirement'),
            (r"scalability[:\s]+(.+)", 'scalability', 'requirement'),
            (r"availability[:\s]+(.+)", 'availability', 'requirement'),
            (r"must be (.+compatible)", 'compatibility', 'requirement'),
            (r"integrate with (.+)", 'integration', 'external_system')
        ]
        
        # Extract from combined text
        text = f"{title} {body}".lower()
        
        # Extract functional requirements
        for pattern, req_type, category in functional_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                requirements.append({
                    'type': req_type,
                    'category': category,
                    'description': match.strip(),
                    'priority': self._determine_priority(match)
                })
        
        # Extract non-functional requirements
        for pattern, req_type, category in nonfunctional_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                requirements.append({
                    'type': req_type,
                    'category': category,
                    'description': match.strip(),
                    'priority': 'high' if req_type in ['security', 'performance'] else 'medium'
                })
        
        # Extract acceptance criteria
        if "acceptance criteria" in text or "definition of done" in text:
            criteria_section = text.split("acceptance criteria")[-1] if "acceptance criteria" in text else text.split("definition of done")[-1]
            criteria_items = re.findall(r"[-*]\s*(.+)", criteria_section)
            for item in criteria_items[:5]:  # Limit to first 5 items
                requirements.append({
                    'type': 'acceptance',
                    'category': 'validation',
                    'description': item.strip(),
                    'priority': 'high'
                })
        
        # If no requirements found, create default ones based on title
        if not requirements:
            requirements.append({
                'type': 'functional',
                'category': 'general',
                'description': title.lower(),
                'priority': 'medium'
            })
        
        return requirements
    
    def _determine_priority(self, text: str) -> str:
        """Determine requirement priority based on keywords"""
        high_priority_words = ['critical', 'urgent', 'must', 'required', 'essential']
        low_priority_words = ['nice to have', 'optional', 'future', 'consider']
        
        text_lower = text.lower()
        
        if any(word in text_lower for word in high_priority_words):
            return 'high'
        elif any(word in text_lower for word in low_priority_words):
            return 'low'
        else:
            return 'medium'
    
    def analyze_context(self, issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the context and constraints of the issue"""
        context = {
            'domain': self._determine_domain(issue_data),
            'scale': self._determine_scale(issue_data),
            'timeline': self._determine_timeline(issue_data),
            'team_size': self._estimate_team_size(issue_data),
            'existing_stack': self._detect_existing_stack(issue_data)
        }
        return context
    
    def _determine_domain(self, issue_data: Dict[str, Any]) -> str:
        """Determine the application domain"""
        title_body = f"{issue_data.get('title', '')} {issue_data.get('body', '')}".lower()
        
        domains = {
            'ecommerce': ['cart', 'payment', 'checkout', 'product', 'order'],
            'analytics': ['dashboard', 'metrics', 'report', 'analytics', 'visualization'],
            'social': ['user', 'profile', 'feed', 'comment', 'share'],
            'enterprise': ['workflow', 'approval', 'permission', 'role', 'audit'],
            'iot': ['sensor', 'device', 'telemetry', 'mqtt', 'real-time'],
            'ml': ['model', 'training', 'prediction', 'dataset', 'algorithm']
        }
        
        for domain, keywords in domains.items():
            if any(keyword in title_body for keyword in keywords):
                return domain
        
        return 'general'
    
    def _determine_scale(self, issue_data: Dict[str, Any]) -> str:
        """Determine the expected scale of the application"""
        text = f"{issue_data.get('title', '')} {issue_data.get('body', '')}".lower()
        
        if any(word in text for word in ['million', 'high traffic', 'large scale', 'enterprise']):
            return 'large'
        elif any(word in text for word in ['thousand', 'medium scale', 'moderate']):
            return 'medium'
        else:
            return 'small'
    
    def _determine_timeline(self, issue_data: Dict[str, Any]) -> str:
        """Determine the timeline urgency"""
        labels = [label.lower() for label in issue_data.get('labels', [])]
        
        if any('urgent' in label or 'critical' in label for label in labels):
            return 'urgent'
        elif any('soon' in label or 'priority' in label for label in labels):
            return 'normal'
        else:
            return 'flexible'
    
    def _estimate_team_size(self, issue_data: Dict[str, Any]) -> str:
        """Estimate team size based on issue complexity"""
        # This is a simple heuristic
        assignees = issue_data.get('assignees', [])
        if len(assignees) > 3:
            return 'large'
        elif len(assignees) > 1:
            return 'medium'
        else:
            return 'small'
    
    def _detect_existing_stack(self, issue_data: Dict[str, Any]) -> List[str]:
        """Detect mentions of existing technology stack"""
        text = f"{issue_data.get('title', '')} {issue_data.get('body', '')}".lower()
        
        detected_stack = []
        tech_keywords = {
            'react': 'React',
            'angular': 'Angular',
            'vue': 'Vue.js',
            'node': 'Node.js',
            'python': 'Python',
            'django': 'Django',
            'flask': 'Flask',
            'postgres': 'PostgreSQL',
            'mongodb': 'MongoDB',
            'redis': 'Redis',
            'docker': 'Docker',
            'kubernetes': 'Kubernetes',
            'aws': 'AWS',
            'azure': 'Azure',
            'gcp': 'Google Cloud'
        }
        
        for keyword, tech in tech_keywords.items():
            if keyword in text:
                detected_stack.append(tech)
        
        return detected_stack
    
    def determine_technical_approach(self, requirements: List[Dict], labels: List[str], context: Dict[str, Any]) -> Dict[str, Any]:
        """Determine the best technical approach based on requirements and context"""
        
        approach = {
            'architecture_pattern': 'microservices',
            'api_design': 'REST',
            'database_strategy': 'relational',
            'deployment_model': 'containerized',
            'integration_pattern': 'request_response',
            'caching_strategy': 'redis',
            'security_model': 'jwt_oauth2',
            'monitoring_approach': 'observability'
        }
        
        # Analyze requirements to determine best approach
        req_text = ' '.join([req['description'] for req in requirements]).lower()
        
        # Architecture pattern selection
        if context['scale'] == 'large' or 'microservice' in req_text:
            approach['architecture_pattern'] = 'microservices'
        elif context['scale'] == 'small' and context['timeline'] == 'urgent':
            approach['architecture_pattern'] = 'monolithic'
        elif 'serverless' in req_text or 'lambda' in req_text:
            approach['architecture_pattern'] = 'serverless'
        elif 'event' in req_text or 'real-time' in req_text:
            approach['architecture_pattern'] = 'event_driven'
        
        # API design selection
        if 'graphql' in req_text:
            approach['api_design'] = 'GraphQL'
        elif 'real-time' in req_text or 'websocket' in req_text:
            approach['api_design'] = 'WebSocket'
        elif 'grpc' in req_text or approach['architecture_pattern'] == 'microservices':
            approach['api_design'] = 'gRPC'
        else:
            approach['api_design'] = 'REST'
        
        # Database strategy
        if 'nosql' in req_text or 'document' in req_text or 'flexible schema' in req_text:
            approach['database_strategy'] = 'nosql'
        elif 'graph' in req_text and 'database' in req_text:
            approach['database_strategy'] = 'graph'
        elif context['domain'] == 'analytics':
            approach['database_strategy'] = 'hybrid'  # OLTP + OLAP
        else:
            approach['database_strategy'] = 'relational'
        
        # Deployment model
        if 'kubernetes' in req_text or context['scale'] == 'large':
            approach['deployment_model'] = 'kubernetes'
        elif approach['architecture_pattern'] == 'serverless':
            approach['deployment_model'] = 'serverless'
        else:
            approach['deployment_model'] = 'containerized'
        
        # Integration pattern
        if 'event' in req_text or 'async' in req_text:
            approach['integration_pattern'] = 'event_driven'
        elif 'real-time' in req_text:
            approach['integration_pattern'] = 'streaming'
        elif 'batch' in req_text:
            approach['integration_pattern'] = 'batch_processing'
        
        # Update metrics
        self.metrics['architecture_patterns_used'][approach['architecture_pattern']] += 1
        
        return approach
    
    def recommend_technology_stack(self, requirements: List[Dict], approach: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, List[str]]:
        """Recommend specific technologies based on requirements, approach, and context"""
        
        stack = {
            'frontend': [],
            'backend': [],
            'database': [],
            'infrastructure': [],
            'monitoring': [],
            'testing': [],
            'cicd': []
        }
        
        req_text = ' '.join([req['description'] for req in requirements]).lower()
        
        # Frontend recommendations
        if 'mobile' in req_text:
            if 'cross-platform' in req_text:
                stack['frontend'] = ['React Native', 'TypeScript', 'Expo', 'Redux']
            else:
                stack['frontend'] = ['Swift (iOS)', 'Kotlin (Android)']
        elif 'dashboard' in req_text or context['domain'] == 'analytics':
            stack['frontend'] = ['React', 'TypeScript', 'Material-UI', 'Chart.js', 'D3.js']
        elif context['scale'] == 'large':
            stack['frontend'] = ['React', 'TypeScript', 'Redux', 'Webpack', 'Jest']
        elif context['existing_stack'] and 'Vue.js' in context['existing_stack']:
            stack['frontend'] = ['Vue.js', 'TypeScript', 'Vuex', 'Vuetify']
        else:
            stack['frontend'] = ['React', 'TypeScript', 'Tailwind CSS', 'Vite']
        
        # Backend recommendations
        if approach['architecture_pattern'] == 'microservices':
            if context['domain'] == 'ml':
                stack['backend'] = ['Python', 'FastAPI', 'Celery', 'Docker']
            else:
                stack['backend'] = ['Node.js', 'Express', 'TypeScript', 'Docker', 'RabbitMQ']
        elif approach['architecture_pattern'] == 'serverless':
            stack['backend'] = ['AWS Lambda', 'API Gateway', 'DynamoDB', 'Python/Node.js']
        elif context['domain'] == 'enterprise':
            stack['backend'] = ['Java', 'Spring Boot', 'Hibernate', 'Maven']
        elif 'Python' in context['existing_stack']:
            stack['backend'] = ['Python', 'Django', 'Django REST Framework', 'Celery']
        else:
            stack['backend'] = ['Node.js', 'Express', 'TypeScript', 'Prisma']
        
        # Database recommendations
        if approach['database_strategy'] == 'nosql':
            if context['domain'] == 'social':
                stack['database'] = ['MongoDB', 'Redis', 'Elasticsearch']
            else:
                stack['database'] = ['MongoDB', 'Redis']
        elif approach['database_strategy'] == 'graph':
            stack['database'] = ['Neo4j', 'Redis']
        elif approach['database_strategy'] == 'hybrid':
            stack['database'] = ['PostgreSQL', 'ClickHouse', 'Redis']
        else:
            stack['database'] = ['PostgreSQL', 'Redis']
        
        # Infrastructure recommendations
        if approach['deployment_model'] == 'kubernetes':
            stack['infrastructure'] = ['Docker', 'Kubernetes', 'Helm', 'Istio', 'AWS EKS']
        elif approach['deployment_model'] == 'serverless':
            stack['infrastructure'] = ['AWS Lambda', 'API Gateway', 'CloudFormation', 'S3']
        else:
            stack['infrastructure'] = ['Docker', 'Docker Compose', 'Nginx', 'AWS EC2']
        
        # Add Terraform for infrastructure as code
        if context['scale'] != 'small':
            stack['infrastructure'].append('Terraform')
        
        # Monitoring recommendations
        if context['scale'] == 'large':
            stack['monitoring'] = ['Prometheus', 'Grafana', 'ELK Stack', 'Jaeger', 'DataDog']
        else:
            stack['monitoring'] = ['Prometheus', 'Grafana', 'Sentry']
        
        # Testing recommendations
        stack['testing'] = ['Jest', 'Cypress', 'Postman', 'K6']
        
        # CI/CD recommendations
        stack['cicd'] = ['GitHub Actions', 'Docker Hub', 'ArgoCD']
        
        # Track technology recommendations
        for category, techs in stack.items():
            for tech in techs:
                self.metrics['technology_recommendations'][tech] += 1
        
        return stack
    
    def identify_risks(self, requirements: List[Dict], approach: Dict[str, Any]) -> List[Dict[str, str]]:
        """Identify potential risks in the technical approach"""
        risks = []
        
        # Architecture risks
        if approach['architecture_pattern'] == 'microservices':
            risks.append({
                'type': 'complexity',
                'description': 'Microservices add operational complexity',
                'mitigation': 'Implement proper service mesh and observability',
                'severity': 'medium'
            })
        
        if approach['architecture_pattern'] == 'serverless':
            risks.append({
                'type': 'vendor_lock',
                'description': 'Serverless creates vendor lock-in',
                'mitigation': 'Use abstraction layers and maintain portability',
                'severity': 'medium'
            })
        
        # Performance risks
        perf_reqs = [r for r in requirements if r['type'] == 'performance']
        if perf_reqs:
            risks.append({
                'type': 'performance',
                'description': 'High performance requirements may not be met',
                'mitigation': 'Implement caching, CDN, and load testing',
                'severity': 'high'
            })
        
        # Security risks
        sec_reqs = [r for r in requirements if r['type'] == 'security']
        if sec_reqs or approach.get('security_model') == 'jwt_oauth2':
            risks.append({
                'type': 'security',
                'description': 'Authentication and authorization vulnerabilities',
                'mitigation': 'Implement security best practices and regular audits',
                'severity': 'high'
            })
        
        # Integration risks
        if approach['integration_pattern'] == 'event_driven':
            risks.append({
                'type': 'integration',
                'description': 'Event-driven systems can have ordering and consistency issues',
                'mitigation': 'Implement idempotency and event sourcing',
                'severity': 'medium'
            })
        
        # Scalability risks
        if approach['database_strategy'] == 'relational' and any('scale' in r['description'] for r in requirements):
            risks.append({
                'type': 'scalability',
                'description': 'Relational database may become bottleneck',
                'mitigation': 'Plan for sharding or read replicas',
                'severity': 'medium'
            })
        
        return risks
    
    def identify_dependencies(self, requirements: List[Dict], tech_stack: Dict[str, List[str]]) -> List[str]:
        """Identify external dependencies and integrations"""
        dependencies = []
        
        # Extract mentioned external systems
        req_text = ' '.join([req['description'] for req in requirements]).lower()
        
        # Common external dependencies
        external_systems = {
            'payment': ['Stripe API', 'PayPal SDK'],
            'email': ['SendGrid', 'AWS SES'],
            'sms': ['Twilio'],
            'storage': ['AWS S3', 'Google Cloud Storage'],
            'cdn': ['CloudFlare', 'AWS CloudFront'],
            'auth': ['Auth0', 'Firebase Auth'],
            'analytics': ['Google Analytics', 'Mixpanel'],
            'search': ['Elasticsearch', 'Algolia'],
            'maps': ['Google Maps API', 'Mapbox']
        }
        
        for keyword, deps in external_systems.items():
            if keyword in req_text:
                dependencies.extend(deps)
        
        # Add technology-specific dependencies
        if 'React' in tech_stack.get('frontend', []):
            dependencies.append('npm packages')
        
        if 'Python' in str(tech_stack.get('backend', [])):
            dependencies.append('pip packages')
        
        if 'Docker' in tech_stack.get('infrastructure', []):
            dependencies.append('Docker Hub')
        
        return list(set(dependencies))  # Remove duplicates
    
    def create_architecture_specification(self, analysis: Dict[str, Any]) -> TechnicalSpecification:
        """Create detailed architecture specification"""
        
        spec_id = f"arch-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{hashlib.md5(str(analysis).encode()).hexdigest()[:6]}"
        
        spec = TechnicalSpecification(
            spec_id=spec_id,
            issue_id=analysis['issue_id'],
            title=analysis['title'],
            created_at=datetime.now().isoformat(),
            requirements=analysis['requirements'],
            architecture=self.generate_architecture_design(analysis),
            api_design=self.generate_api_specification(analysis),
            database_design=self.generate_database_design(analysis),
            technology_stack=analysis['technology_stack'],
            deployment_strategy=self.generate_deployment_strategy(analysis),
            implementation_roadmap=self.generate_implementation_roadmap(analysis),
            complexity_score=analysis['complexity_score'],
            estimated_effort=analysis['estimated_effort'],
            dependencies=analysis['dependencies'],
            risks=analysis['risks']
        )
        
        # Store specification
        self.specifications[spec_id] = spec
        self.metrics['specifications_created'] += 1
        self.metrics['total_complexity_score'] += spec.complexity_score
        
        return spec
    
    def generate_architecture_design(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate detailed system architecture design"""
        
        approach = analysis['technical_approach']
        tech_stack = analysis['technology_stack']
        
        # Base components based on architecture pattern
        if approach['architecture_pattern'] == 'microservices':
            components = [
                {'name': 'API Gateway', 'type': 'Infrastructure', 'technologies': ['Kong', 'nginx'], 'responsibilities': ['Routing', 'Rate limiting', 'Authentication']},
                {'name': 'Service Discovery', 'type': 'Infrastructure', 'technologies': ['Consul', 'Eureka'], 'responsibilities': ['Service registration', 'Health checking']},
                {'name': 'User Service', 'type': 'Service', 'technologies': tech_stack['backend'], 'responsibilities': ['User management', 'Authentication']},
                {'name': 'Business Logic Service', 'type': 'Service', 'technologies': tech_stack['backend'], 'responsibilities': ['Core business logic']},
                {'name': 'Notification Service', 'type': 'Service', 'technologies': ['Node.js'], 'responsibilities': ['Email', 'SMS', 'Push notifications']},
                {'name': 'Message Broker', 'type': 'Infrastructure', 'technologies': ['RabbitMQ', 'Kafka'], 'responsibilities': ['Async communication', 'Event streaming']}
            ]
        elif approach['architecture_pattern'] == 'serverless':
            components = [
                {'name': 'API Gateway', 'type': 'Infrastructure', 'technologies': ['AWS API Gateway'], 'responsibilities': ['HTTP routing', 'Request validation']},
                {'name': 'Lambda Functions', 'type': 'Compute', 'technologies': ['AWS Lambda'], 'responsibilities': ['Business logic execution']},
                {'name': 'Event Bus', 'type': 'Infrastructure', 'technologies': ['AWS EventBridge'], 'responsibilities': ['Event routing', 'Integration']},
                {'name': 'Storage', 'type': 'Data', 'technologies': ['S3', 'DynamoDB'], 'responsibilities': ['Object storage', 'Data persistence']}
            ]
        else:  # Monolithic
            components = [
                {'name': 'Web Server', 'type': 'Infrastructure', 'technologies': ['Nginx'], 'responsibilities': ['Static content', 'Reverse proxy']},
                {'name': 'Application Server', 'type': 'Application', 'technologies': tech_stack['backend'], 'responsibilities': ['Business logic', 'API endpoints']},
                {'name': 'Background Jobs', 'type': 'Application', 'technologies': ['Celery', 'Sidekiq'], 'responsibilities': ['Async processing', 'Scheduled tasks']}
            ]
        
        # Add common components
        components.extend([
            {'name': 'Frontend', 'type': 'UI', 'technologies': tech_stack['frontend'], 'responsibilities': ['User interface', 'User experience']},
            {'name': 'Database', 'type': 'Data', 'technologies': tech_stack['database'], 'responsibilities': ['Data persistence', 'Queries']},
            {'name': 'Cache', 'type': 'Data', 'technologies': ['Redis'], 'responsibilities': ['Session storage', 'Query caching']},
            {'name': 'CDN', 'type': 'Infrastructure', 'technologies': ['CloudFlare'], 'responsibilities': ['Static asset delivery', 'Edge caching']}
        ])
        
        # Define connections
        connections = []
        if approach['architecture_pattern'] == 'microservices':
            connections = [
                {'from': 'Frontend', 'to': 'API Gateway', 'type': 'HTTPS', 'protocol': 'REST/GraphQL'},
                {'from': 'API Gateway', 'to': 'User Service', 'type': 'HTTP', 'protocol': 'REST'},
                {'from': 'API Gateway', 'to': 'Business Logic Service', 'type': 'HTTP', 'protocol': 'REST'},
                {'from': 'Business Logic Service', 'to': 'Database', 'type': 'TCP', 'protocol': 'SQL'},
                {'from': 'Business Logic Service', 'to': 'Message Broker', 'type': 'AMQP', 'protocol': 'Async'},
                {'from': 'Message Broker', 'to': 'Notification Service', 'type': 'AMQP', 'protocol': 'Async'},
                {'from': 'All Services', 'to': 'Cache', 'type': 'TCP', 'protocol': 'Redis Protocol'}
            ]
        else:
            connections = [
                {'from': 'Frontend', 'to': 'Web Server', 'type': 'HTTPS', 'protocol': 'HTTP'},
                {'from': 'Web Server', 'to': 'Application Server', 'type': 'HTTP', 'protocol': 'FastCGI/Proxy'},
                {'from': 'Application Server', 'to': 'Database', 'type': 'TCP', 'protocol': 'SQL'},
                {'from': 'Application Server', 'to': 'Cache', 'type': 'TCP', 'protocol': 'Redis Protocol'}
            ]
        
        # Security layers
        security_layers = [
            {'layer': 'Network', 'measures': ['Firewall', 'VPC', 'Security Groups']},
            {'layer': 'Application', 'measures': ['JWT Authentication', 'RBAC', 'Input Validation']},
            {'layer': 'Data', 'measures': ['Encryption at rest', 'Encryption in transit', 'Backup']},
            {'layer': 'Monitoring', 'measures': ['Intrusion Detection', 'Audit Logging', 'Alerting']}
        ]
        
        return {
            'pattern': approach['architecture_pattern'],
            'components': components,
            'connections': connections,
            'security_layers': security_layers,
            'scalability_approach': self._determine_scalability_approach(approach),
            'data_flow': self._generate_data_flow(components, connections)
        }
    
    def _determine_scalability_approach(self, approach: Dict[str, Any]) -> Dict[str, Any]:
        """Determine scalability approach based on architecture"""
        if approach['architecture_pattern'] == 'microservices':
            return {
                'horizontal_scaling': True,
                'auto_scaling': True,
                'load_balancing': 'Application Load Balancer',
                'scaling_triggers': ['CPU > 70%', 'Memory > 80%', 'Request Rate > 1000/min']
            }
        elif approach['architecture_pattern'] == 'serverless':
            return {
                'horizontal_scaling': True,
                'auto_scaling': True,
                'load_balancing': 'Automatic (Serverless)',
                'scaling_triggers': ['Automatic based on requests']
            }
        else:
            return {
                'horizontal_scaling': False,
                'auto_scaling': False,
                'load_balancing': 'Nginx',
                'scaling_triggers': ['Manual scaling required']
            }
    
    def _generate_data_flow(self, components: List[Dict], connections: List[Dict]) -> List[Dict[str, str]]:
        """Generate data flow description"""
        return [
            {'step': '1', 'description': 'User interacts with Frontend'},
            {'step': '2', 'description': 'Frontend sends API request'},
            {'step': '3', 'description': 'API Gateway validates and routes request'},
            {'step': '4', 'description': 'Service processes business logic'},
            {'step': '5', 'description': 'Database query/update performed'},
            {'step': '6', 'description': 'Response returned through gateway'},
            {'step': '7', 'description': 'Frontend updates UI with response'}
        ]
    
    def generate_api_specification(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate OpenAPI specification"""
        
        # Determine API style
        api_style = analysis['technical_approach']['api_design']
        
        if api_style == 'GraphQL':
            return self._generate_graphql_schema(analysis)
        elif api_style == 'gRPC':
            return self._generate_grpc_spec(analysis)
        else:
            return self._generate_openapi_spec(analysis)
    
    def _generate_openapi_spec(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate OpenAPI/REST specification"""
        
        # Extract entities from requirements
        entities = self._extract_entities(analysis['requirements'])
        
        paths = {}
        schemas = {}
        
        for entity in entities:
            entity_name = entity.lower()
            entity_title = entity.capitalize()
            
            # CRUD endpoints
            paths[f'/{entity_name}s'] = {
                'get': {
                    'summary': f'List all {entity_name}s',
                    'operationId': f'list{entity_title}s',
                    'tags': [entity_title],
                    'parameters': [
                        {'name': 'limit', 'in': 'query', 'schema': {'type': 'integer', 'default': 20}},
                        {'name': 'offset', 'in': 'query', 'schema': {'type': 'integer', 'default': 0}}
                    ],
                    'responses': {
                        '200': {
                            'description': 'Successful response',
                            'content': {'application/json': {'schema': {'type': 'array', 'items': {'$ref': f'#/components/schemas/{entity_title}'}}}}
                        }
                    }
                },
                'post': {
                    'summary': f'Create a new {entity_name}',
                    'operationId': f'create{entity_title}',
                    'tags': [entity_title],
                    'requestBody': {
                        'required': True,
                        'content': {'application/json': {'schema': {'$ref': f'#/components/schemas/{entity_title}Input'}}}
                    },
                    'responses': {
                        '201': {
                            'description': 'Created successfully',
                            'content': {'application/json': {'schema': {'$ref': f'#/components/schemas/{entity_title}'}}}
                        }
                    }
                }
            }
            
            paths[f'/{entity_name}s/{{id}}'] = {
                'get': {
                    'summary': f'Get {entity_name} by ID',
                    'operationId': f'get{entity_title}',
                    'tags': [entity_title],
                    'parameters': [
                        {'name': 'id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}
                    ],
                    'responses': {
                        '200': {
                            'description': 'Successful response',
                            'content': {'application/json': {'schema': {'$ref': f'#/components/schemas/{entity_title}'}}}
                        },
                        '404': {'description': 'Not found'}
                    }
                },
                'put': {
                    'summary': f'Update {entity_name}',
                    'operationId': f'update{entity_title}',
                    'tags': [entity_title],
                    'parameters': [
                        {'name': 'id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}
                    ],
                    'requestBody': {
                        'required': True,
                        'content': {'application/json': {'schema': {'$ref': f'#/components/schemas/{entity_title}Input'}}}
                    },
                    'responses': {
                        '200': {
                            'description': 'Updated successfully',
                            'content': {'application/json': {'schema': {'$ref': f'#/components/schemas/{entity_title}'}}}
                        }
                    }
                },
                'delete': {
                    'summary': f'Delete {entity_name}',
                    'operationId': f'delete{entity_title}',
                    'tags': [entity_title],
                    'parameters': [
                        {'name': 'id', 'in': 'path', 'required': True, 'schema': {'type': 'string'}}
                    ],
                    'responses': {
                        '204': {'description': 'Deleted successfully'}
                    }
                }
            }
            
            # Generate schemas
            schemas[entity_title] = {
                'type': 'object',
                'properties': {
                    'id': {'type': 'string', 'format': 'uuid'},
                    'createdAt': {'type': 'string', 'format': 'date-time'},
                    'updatedAt': {'type': 'string', 'format': 'date-time'}
                },
                'required': ['id']
            }
            
            schemas[f'{entity_title}Input'] = {
                'type': 'object',
                'properties': {},
                'required': []
            }
        
        return {
            'openapi': '3.0.3',
            'info': {
                'title': f"API for {analysis['title']}",
                'version': '1.0.0',
                'description': 'Auto-generated API specification'
            },
            'servers': [
                {'url': 'https://api.example.com/v1', 'description': 'Production'},
                {'url': 'https://staging-api.example.com/v1', 'description': 'Staging'},
                {'url': 'http://localhost:3000/v1', 'description': 'Development'}
            ],
            'paths': paths,
            'components': {
                'schemas': schemas,
                'securitySchemes': {
                    'bearerAuth': {
                        'type': 'http',
                        'scheme': 'bearer',
                        'bearerFormat': 'JWT'
                    }
                }
            },
            'security': [{'bearerAuth': []}]
        }
    
    def _generate_graphql_schema(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate GraphQL schema"""
        entities = self._extract_entities(analysis['requirements'])
        
        types = []
        queries = []
        mutations = []
        
        for entity in entities:
            # Generate type
            types.append(f"""
type {entity} {{
    id: ID!
    createdAt: DateTime!
    updatedAt: DateTime!
}}""")
            
            # Generate queries
            queries.append(f"    {entity.lower()}(id: ID!): {entity}")
            queries.append(f"    {entity.lower()}s(limit: Int, offset: Int): [{entity}!]!")
            
            # Generate mutations
            mutations.append(f"    create{entity}(input: {entity}Input!): {entity}!")
            mutations.append(f"    update{entity}(id: ID!, input: {entity}Input!): {entity}!")
            mutations.append(f"    delete{entity}(id: ID!): Boolean!")
        
        return {
            'schema': f"""
{"".join(types)}

type Query {{
{chr(10).join(queries)}
}}

type Mutation {{
{chr(10).join(mutations)}
}}
""",
            'resolvers': 'To be implemented by AI Developer Agent'
        }
    
    def _generate_grpc_spec(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate gRPC specification"""
        entities = self._extract_entities(analysis['requirements'])
        
        proto_content = """syntax = "proto3";

package api;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

"""
        
        for entity in entities:
            proto_content += f"""
message {entity} {{
    string id = 1;
    google.protobuf.Timestamp created_at = 2;
    google.protobuf.Timestamp updated_at = 3;
}}

message {entity}Request {{
    string id = 1;
}}

message {entity}ListRequest {{
    int32 limit = 1;
    int32 offset = 2;
}}

message {entity}ListResponse {{
    repeated {entity} items = 1;
}}

service {entity}Service {{
    rpc Get({entity}Request) returns ({entity});
    rpc List({entity}ListRequest) returns ({entity}ListResponse);
    rpc Create({entity}) returns ({entity});
    rpc Update({entity}) returns ({entity});
    rpc Delete({entity}Request) returns (google.protobuf.Empty);
}}
"""
        
        return {
            'proto_file': proto_content,
            'services': [f'{entity}Service' for entity in entities]
        }
    
    def _extract_entities(self, requirements: List[Dict]) -> List[str]:
        """Extract entities from requirements"""
        entities = set()
        
        # Common entity patterns
        entity_patterns = [
            r'manage (\w+)s?',
            r'create (\w+)s?',
            r'(\w+) management',
            r'(\w+) system'
        ]
        
        req_text = ' '.join([req['description'] for req in requirements]).lower()
        
        for pattern in entity_patterns:
            matches = re.findall(pattern, req_text)
            entities.update(matches)
        
        # Filter common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'system', 'application'}
        entities = {e.capitalize() for e in entities if e not in common_words and len(e) > 2}
        
        # Default entities if none found
        if not entities:
            entities = {'User', 'Resource', 'Data'}
        
        return list(entities)
    
    def generate_database_design(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate database schema design"""
        
        db_strategy = analysis['technical_approach']['database_strategy']
        entities = self._extract_entities(analysis['requirements'])
        
        if db_strategy == 'nosql':
            return self._generate_nosql_schema(entities, analysis)
        elif db_strategy == 'graph':
            return self._generate_graph_schema(entities, analysis)
        else:
            return self._generate_relational_schema(entities, analysis)
    
    def _generate_relational_schema(self, entities: List[str], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate relational database schema"""
        
        tables = []
        relationships = []
        indexes = []
        
        # Common base fields
        base_fields = [
            {'name': 'id', 'type': 'UUID', 'constraints': ['PRIMARY KEY', 'DEFAULT gen_random_uuid()']},
            {'name': 'created_at', 'type': 'TIMESTAMP', 'constraints': ['NOT NULL', 'DEFAULT CURRENT_TIMESTAMP']},
            {'name': 'updated_at', 'type': 'TIMESTAMP', 'constraints': ['NOT NULL', 'DEFAULT CURRENT_TIMESTAMP']}
        ]
        
        for entity in entities:
            table_name = f'{entity.lower()}s'
            
            # Generate table structure
            table = {
                'name': table_name,
                'fields': base_fields.copy()
            }
            
            # Add entity-specific fields based on common patterns
            if entity.lower() == 'user':
                table['fields'].extend([
                    {'name': 'email', 'type': 'VARCHAR(255)', 'constraints': ['UNIQUE', 'NOT NULL']},
                    {'name': 'username', 'type': 'VARCHAR(100)', 'constraints': ['UNIQUE', 'NOT NULL']},
                    {'name': 'password_hash', 'type': 'VARCHAR(255)', 'constraints': ['NOT NULL']},
                    {'name': 'is_active', 'type': 'BOOLEAN', 'constraints': ['DEFAULT true']}
                ])
                indexes.append({'table': table_name, 'columns': ['email'], 'type': 'BTREE'})
                indexes.append({'table': table_name, 'columns': ['username'], 'type': 'BTREE'})
            
            elif 'product' in entity.lower():
                table['fields'].extend([
                    {'name': 'name', 'type': 'VARCHAR(255)', 'constraints': ['NOT NULL']},
                    {'name': 'description', 'type': 'TEXT', 'constraints': []},
                    {'name': 'price', 'type': 'DECIMAL(10,2)', 'constraints': ['NOT NULL']},
                    {'name': 'stock', 'type': 'INTEGER', 'constraints': ['DEFAULT 0']}
                ])
                indexes.append({'table': table_name, 'columns': ['name'], 'type': 'BTREE'})
            
            else:
                # Generic entity fields
                table['fields'].extend([
                    {'name': 'name', 'type': 'VARCHAR(255)', 'constraints': ['NOT NULL']},
                    {'name': 'description', 'type': 'TEXT', 'constraints': []},
                    {'name': 'status', 'type': 'VARCHAR(50)', 'constraints': ['DEFAULT \'active\'']}
                ])
            
            tables.append(table)
        
        # Generate relationships (simplified - assuming User relationship)
        if len(entities) > 1 and 'User' in entities:
            for entity in entities:
                if entity != 'User':
                    relationships.append({
                        'type': 'one_to_many',
                        'from': 'users',
                        'to': f'{entity.lower()}s',
                        'foreign_key': 'user_id',
                        'on_delete': 'CASCADE'
                    })
                    
                    # Add foreign key to table
                    for table in tables:
                        if table['name'] == f'{entity.lower()}s':
                            table['fields'].append({
                                'name': 'user_id',
                                'type': 'UUID',
                                'constraints': ['REFERENCES users(id)', 'ON DELETE CASCADE']
                            })
        
        # Generate migrations
        migrations = []
        for table in tables:
            migration = f"CREATE TABLE {table['name']} (\n"
            for field in table['fields']:
                migration += f"    {field['name']} {field['type']}"
                if field['constraints']:
                    migration += ' ' + ' '.join(field['constraints'])
                migration += ',\n'
            migration = migration.rstrip(',\n') + '\n);'
            migrations.append(migration)
        
        return {
            'type': 'relational',
            'engine': 'PostgreSQL',
            'tables': tables,
            'relationships': relationships,
            'indexes': indexes,
            'migrations': migrations,
            'backup_strategy': 'Daily automated backups with point-in-time recovery'
        }
    
    def _generate_nosql_schema(self, entities: List[str], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate NoSQL database schema"""
        
        collections = []
        
        for entity in entities:
            collection = {
                'name': entity.lower(),
                'schema': {
                    '_id': 'ObjectId',
                    'createdAt': 'Date',
                    'updatedAt': 'Date'
                },
                'indexes': [
                    {'field': 'createdAt', 'type': 'ascending'}
                ],
                'sharding': {
                    'enabled': analysis['context']['scale'] == 'large',
                    'key': '_id'
                }
            }
            
            # Add entity-specific fields
            if entity.lower() == 'user':
                collection['schema'].update({
                    'email': 'String (unique)',
                    'username': 'String (unique)',
                    'profile': 'Object',
                    'settings': 'Object'
                })
                collection['indexes'].extend([
                    {'field': 'email', 'type': 'unique'},
                    {'field': 'username', 'type': 'unique'}
                ])
            else:
                collection['schema'].update({
                    'name': 'String',
                    'data': 'Object',
                    'metadata': 'Object',
                    'tags': 'Array'
                })
            
            collections.append(collection)
        
        return {
            'type': 'document',
            'engine': 'MongoDB',
            'collections': collections,
            'replication': {
                'enabled': True,
                'factor': 3
            },
            'backup_strategy': 'Continuous replication with daily snapshots'
        }
    
    def _generate_graph_schema(self, entities: List[str], analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate graph database schema"""
        
        nodes = []
        edges = []
        
        for entity in entities:
            nodes.append({
                'label': entity,
                'properties': {
                    'id': 'String (unique)',
                    'created_at': 'DateTime',
                    'updated_at': 'DateTime'
                }
            })
        
        # Generate relationships
        if len(entities) > 1:
            for i, entity1 in enumerate(entities):
                for entity2 in entities[i+1:]:
                    edges.append({
                        'type': 'RELATES_TO',
                        'from': entity1,
                        'to': entity2,
                        'properties': {
                            'created_at': 'DateTime',
                            'weight': 'Float'
                        }
                    })
        
        return {
            'type': 'graph',
            'engine': 'Neo4j',
            'nodes': nodes,
            'edges': edges,
            'indexes': [{'label': node['label'], 'property': 'id'} for node in nodes],
            'backup_strategy': 'Online backups with causal clustering'
        }
    
    def generate_deployment_strategy(self, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Generate deployment and infrastructure strategy"""
        
        approach = analysis['technical_approach']
        context = analysis['context']
        
        strategy = {
            'environments': [
                {
                    'name': 'development',
                    'infrastructure': 'Local Docker Compose',
                    'deployment': 'Manual',
                    'monitoring': 'Basic logging'
                },
                {
                    'name': 'staging',
                    'infrastructure': 'Kubernetes (single node)',
                    'deployment': 'GitOps with ArgoCD',
                    'monitoring': 'Prometheus + Grafana'
                },
                {
                    'name': 'production',
                    'infrastructure': 'Kubernetes (multi-node)',
                    'deployment': 'GitOps with ArgoCD',
                    'monitoring': 'Full observability stack'
                }
            ],
            'containerization': {
                'enabled': True,
                'base_images': {
                    'frontend': 'node:18-alpine',
                    'backend': 'python:3.11-slim' if 'Python' in str(analysis['technology_stack']) else 'node:18-alpine'
                },
                'registry': 'Docker Hub / ECR',
                'scanning': 'Trivy for vulnerability scanning'
            },
            'orchestration': {
                'platform': 'Kubernetes' if approach['deployment_model'] == 'kubernetes' else 'Docker Swarm',
                'ingress': 'NGINX Ingress Controller',
                'service_mesh': 'Istio' if approach['architecture_pattern'] == 'microservices' else None,
                'autoscaling': {
                    'enabled': context['scale'] != 'small',
                    'metrics': ['CPU', 'Memory', 'Request Rate'],
                    'min_replicas': 2,
                    'max_replicas': 10
                }
            },
            'ci_cd': {
                'provider': 'GitHub Actions',
                'stages': [
                    {'name': 'lint', 'tools': ['ESLint', 'Prettier']},
                    {'name': 'test', 'tools': ['Jest', 'Pytest']},
                    {'name': 'build', 'tools': ['Docker', 'Webpack']},
                    {'name': 'security', 'tools': ['Snyk', 'OWASP ZAP']},
                    {'name': 'deploy', 'tools': ['ArgoCD', 'Helm']}
                ],
                'branch_strategy': 'GitFlow',
                'release_strategy': 'Semantic Versioning'
            },
            'monitoring': {
                'metrics': 'Prometheus',
                'logs': 'ELK Stack' if context['scale'] == 'large' else 'Loki',
                'traces': 'Jaeger' if approach['architecture_pattern'] == 'microservices' else None,
                'alerts': 'AlertManager + PagerDuty',
                'dashboards': 'Grafana'
            },
            'security': {
                'secrets_management': 'Kubernetes Secrets + Sealed Secrets',
                'network_policies': 'Calico',
                'rbac': 'Kubernetes RBAC',
                'scanning': 'Regular vulnerability scanning',
                'compliance': 'SOC2 Type II' if context['domain'] == 'enterprise' else 'Best practices'
            },
            'disaster_recovery': {
                'backup_frequency': 'Daily',
                'backup_retention': '30 days',
                'rto': '4 hours',
                'rpo': '1 hour',
                'failover': 'Multi-region with automatic failover' if context['scale'] == 'large' else 'Manual failover'
            }
        }
        
        return strategy
    
    def generate_implementation_roadmap(self, analysis: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate step-by-step implementation roadmap"""
        
        complexity = analysis['complexity_score']
        approach = analysis['technical_approach']
        
        # Base roadmap phases
        roadmap = [
            {
                'phase': 1,
                'name': 'Project Setup & Foundation',
                'tasks': [
                    'Initialize repository and version control',
                    'Set up development environment',
                    'Configure linting and code formatting',
                    'Set up basic CI/CD pipeline',
                    'Create project documentation structure'
                ],
                'deliverables': ['Development environment', 'CI/CD pipeline', 'Project structure'],
                'duration': '2-3 days',
                'dependencies': []
            },
            {
                'phase': 2,
                'name': 'Infrastructure & DevOps',
                'tasks': [
                    'Set up containerization (Docker)',
                    'Configure local development with Docker Compose',
                    'Set up Kubernetes manifests' if approach['deployment_model'] == 'kubernetes' else 'Configure deployment scripts',
                    'Implement infrastructure as code (Terraform)',
                    'Set up monitoring and logging'
                ],
                'deliverables': ['Docker images', 'Deployment configuration', 'Monitoring setup'],
                'duration': '3-4 days',
                'dependencies': ['Phase 1']
            },
            {
                'phase': 3,
                'name': 'Backend Development',
                'tasks': [
                    'Implement database schema and migrations',
                    'Create data models and ORM setup',
                    'Develop API endpoints',
                    'Implement business logic',
                    'Add authentication and authorization',
                    'Write unit and integration tests'
                ],
                'deliverables': ['API endpoints', 'Database', 'Authentication system'],
                'duration': '5-7 days' if complexity <= 5 else '10-14 days',
                'dependencies': ['Phase 2']
            },
            {
                'phase': 4,
                'name': 'Frontend Development',
                'tasks': [
                    'Set up frontend framework and tooling',
                    'Implement UI components',
                    'Create state management',
                    'Integrate with backend API',
                    'Implement routing and navigation',
                    'Add form validation and error handling',
                    'Write component tests'
                ],
                'deliverables': ['User interface', 'Frontend application', 'Component library'],
                'duration': '5-7 days' if complexity <= 5 else '10-14 days',
                'dependencies': ['Phase 3 (API endpoints)']
            },
            {
                'phase': 5,
                'name': 'Integration & Testing',
                'tasks': [
                    'End-to-end integration testing',
                    'Performance testing and optimization',
                    'Security testing and hardening',
                    'User acceptance testing',
                    'Bug fixes and refinements',
                    'Load testing'
                ],
                'deliverables': ['Test reports', 'Performance metrics', 'Security audit'],
                'duration': '3-5 days',
                'dependencies': ['Phase 4']
            },
            {
                'phase': 6,
                'name': 'Documentation & Training',
                'tasks': [
                    'Write API documentation',
                    'Create user guides',
                    'Document deployment procedures',
                    'Prepare runbooks',
                    'Create architecture diagrams'
                ],
                'deliverables': ['API docs', 'User guides', 'Technical documentation'],
                'duration': '2-3 days',
                'dependencies': ['Phase 5']
            },
            {
                'phase': 7,
                'name': 'Deployment & Go-Live',
                'tasks': [
                    'Deploy to staging environment',
                    'Conduct final testing',
                    'Deploy to production',
                    'Monitor initial performance',
                    'Implement rollback plan if needed'
                ],
                'deliverables': ['Production deployment', 'Monitoring dashboards', 'Go-live checklist'],
                'duration': '2-3 days',
                'dependencies': ['Phase 6']
            }
        ]
        
        # Add additional phases for complex projects
        if approach['architecture_pattern'] == 'microservices':
            roadmap.insert(3, {
                'phase': 3.5,
                'name': 'Microservices Infrastructure',
                'tasks': [
                    'Set up service discovery',
                    'Implement API gateway',
                    'Configure service mesh',
                    'Set up message broker',
                    'Implement distributed tracing'
                ],
                'deliverables': ['Service mesh', 'API gateway', 'Message broker'],
                'duration': '4-5 days',
                'dependencies': ['Phase 2']
            })
        
        # Adjust phase numbers
        for i, phase in enumerate(roadmap):
            phase['phase'] = i + 1
        
        return roadmap
    
    def calculate_complexity(self, requirements: List[Dict], approach: Dict[str, Any], dependencies: List[str]) -> int:
        """Calculate complexity score (1-10)"""
        
        score = 0
        
        # Requirements complexity
        score += min(3, len(requirements) / 3)  # Up to 3 points
        
        # Architecture complexity
        architecture_scores = {
            'monolithic': 1,
            'serverless': 2,
            'microservices': 3,
            'event_driven': 3
        }
        score += architecture_scores.get(approach['architecture_pattern'], 2)
        
        # Integration complexity
        score += min(2, len(dependencies) / 2)  # Up to 2 points
        
        # Technical complexity
        if approach['api_design'] in ['GraphQL', 'gRPC']:
            score += 1
        
        if approach['database_strategy'] in ['graph', 'hybrid']:
            score += 1
        
        return min(10, max(1, int(score)))
    
    def estimate_effort(self, requirements: List[Dict], approach: Dict[str, Any], complexity: int) -> str:
        """Estimate development effort"""
        
        # Base effort calculation
        base_days = complexity * 3
        
        # Adjust for architecture
        if approach['architecture_pattern'] == 'microservices':
            base_days *= 1.5
        elif approach['architecture_pattern'] == 'serverless':
            base_days *= 0.8
        
        # Adjust for team size (assumed from context)
        # This is simplified - real estimation would be more complex
        
        if base_days <= 7:
            return "1 week"
        elif base_days <= 14:
            return "2 weeks"
        elif base_days <= 21:
            return "3 weeks"
        elif base_days <= 30:
            return "4-5 weeks"
        elif base_days <= 60:
            return "6-8 weeks"
        else:
            return "3+ months"
    
    def process_work_item(self, work_item: Dict[str, Any]) -> bool:
        """Process a work item from the work queue"""
        try:
            logger.info(f"Processing work item: {work_item.get('id')}")
            
            # Analyze the GitHub issue
            analysis = self.analyze_github_issue(work_item)
            
            # Create architecture specification
            arch_spec = self.create_architecture_specification(analysis)
            
            # Save specification
            spec_file = self.save_architecture_specification(arch_spec)
            
            # Update work item status
            self.work_queue.update_work_item(
                work_item['id'],
                status='architecture_complete',
                assignee=self.agent_id,
                progress=100
            )
            
            # Notify AI Developer Agent
            self.communication_hub.send_message(
                from_agent=self.agent_id,
                to_agent="ai-developer",
                message_type="architecture_ready",
                payload=asdict(arch_spec)
            )
            
            # Update dashboard
            self.update_dashboard_status(arch_spec)
            
            logger.info(f"Architecture specification created: {spec_file}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing work item: {e}", exc_info=True)
            return False
    
    def save_architecture_specification(self, spec: TechnicalSpecification) -> str:
        """Save architecture specification to file"""
        
        # Create directory structure
        spec_dir = Path("architecture_specs")
        spec_dir.mkdir(exist_ok=True)
        
        # Save as JSON
        json_file = spec_dir / f"{spec.spec_id}.json"
        with open(json_file, 'w') as f:
            json.dump(asdict(spec), f, indent=2, default=str)
        
        # Generate markdown documentation
        md_file = spec_dir / f"{spec.spec_id}.md"
        self.generate_markdown_documentation(spec, md_file)
        
        logger.info(f"Saved specification to {json_file} and {md_file}")
        return str(json_file)
    
    def generate_markdown_documentation(self, spec: TechnicalSpecification, filepath: Path):
        """Generate human-readable markdown documentation"""
        
        md_content = f"""# Technical Architecture Specification

**Document ID:** {spec.spec_id}  
**Issue Reference:** {spec.issue_id}  
**Title:** {spec.title}  
**Created:** {spec.created_at}  
**Complexity Score:** {spec.complexity_score}/10  
**Estimated Effort:** {spec.estimated_effort}

## Executive Summary

This document outlines the technical architecture and implementation strategy for the requested feature.

## Requirements

### Functional Requirements
"""
        
        for req in spec.requirements:
            if req['type'] == 'functional':
                md_content += f"- **{req['category']}**: {req['description']} (Priority: {req['priority']})\n"
        
        md_content += "\n### Non-Functional Requirements\n"
        
        for req in spec.requirements:
            if req['type'] != 'functional':
                md_content += f"- **{req['type']}**: {req['description']} (Priority: {req['priority']})\n"
        
        md_content += f"""
## Architecture Design

**Pattern:** {spec.architecture['pattern']}

### Components

"""
        
        for component in spec.architecture['components']:
            md_content += f"#### {component['name']}\n"
            md_content += f"- **Type:** {component['type']}\n"
            md_content += f"- **Technologies:** {', '.join(component['technologies'])}\n"
            md_content += f"- **Responsibilities:** {', '.join(component['responsibilities'])}\n\n"
        
        md_content += """
## Technology Stack

"""
        
        for category, techs in spec.technology_stack.items():
            md_content += f"### {category.capitalize()}\n"
            for tech in techs:
                md_content += f"- {tech}\n"
            md_content += "\n"
        
        md_content += """
## API Design

"""
        
        if 'openapi' in spec.api_design:
            md_content += f"**Specification:** OpenAPI {spec.api_design['openapi']}\n"
            md_content += f"**Endpoints:** {len(spec.api_design.get('paths', {}))} endpoints defined\n"
        elif 'schema' in spec.api_design:
            md_content += "**Type:** GraphQL\n"
            md_content += "**Schema:** Available in specification file\n"
        
        md_content += f"""
## Database Design

**Type:** {spec.database_design.get('type', 'Unknown')}  
**Engine:** {spec.database_design.get('engine', 'Unknown')}

"""
        
        if 'tables' in spec.database_design:
            md_content += f"**Tables:** {len(spec.database_design['tables'])} tables defined\n"
        elif 'collections' in spec.database_design:
            md_content += f"**Collections:** {len(spec.database_design['collections'])} collections defined\n"
        
        md_content += """
## Deployment Strategy

"""
        
        for env in spec.deployment_strategy.get('environments', []):
            md_content += f"### {env['name'].capitalize()}\n"
            md_content += f"- **Infrastructure:** {env['infrastructure']}\n"
            md_content += f"- **Deployment:** {env['deployment']}\n"
            md_content += f"- **Monitoring:** {env['monitoring']}\n\n"
        
        md_content += """
## Implementation Roadmap

"""
        
        total_duration = 0
        for phase in spec.implementation_roadmap:
            md_content += f"### Phase {phase['phase']}: {phase['name']}\n"
            md_content += f"**Duration:** {phase['duration']}\n"
            md_content += f"**Tasks:**\n"
            for task in phase['tasks']:
                md_content += f"- {task}\n"
            md_content += f"**Deliverables:** {', '.join(phase['deliverables'])}\n\n"
        
        md_content += """
## Risks and Mitigations

"""
        
        for risk in spec.risks:
            md_content += f"### {risk['type'].capitalize()} Risk\n"
            md_content += f"- **Description:** {risk['description']}\n"
            md_content += f"- **Severity:** {risk['severity']}\n"
            md_content += f"- **Mitigation:** {risk['mitigation']}\n\n"
        
        md_content += """
## Dependencies

"""
        
        for dep in spec.dependencies:
            md_content += f"- {dep}\n"
        
        md_content += """

---
*This specification was automatically generated by the AI Architect Agent*
"""
        
        with open(filepath, 'w') as f:
            f.write(md_content)
    
    def update_dashboard_status(self, spec: TechnicalSpecification):
        """Update dashboard with architecture status"""
        try:
            dashboard_url = "http://localhost:5003/api/architect/status"
            
            status_data = {
                'agent_id': self.agent_id,
                'spec_id': spec.spec_id,
                'issue_id': spec.issue_id,
                'title': spec.title,
                'complexity': spec.complexity_score,
                'effort': spec.estimated_effort,
                'status': 'completed',
                'timestamp': datetime.now().isoformat()
            }
            
            response = requests.post(dashboard_url, json=status_data, timeout=5)
            if response.status_code == 200:
                logger.info("Dashboard updated successfully")
            else:
                logger.warning(f"Dashboard update failed: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"Could not update dashboard: {e}")
    
    def should_process_work_item(self, work_item: Dict[str, Any]) -> bool:
        """Determine if this agent should process the work item"""
        work_type = work_item.get('type', '').lower()
        labels = work_item.get('labels', [])
        
        # Process architecture, design, and feature work
        valid_types = ['feature', 'enhancement', 'architecture', 'design', 'technical']
        valid_labels = ['needs-architecture', 'needs-design', 'technical-spec']
        
        return (work_type in valid_types or 
                any(label in valid_labels for label in labels))
    
    def get_status(self) -> Dict[str, Any]:
        """Get agent status and metrics"""
        return {
            'agent_id': self.agent_id,
            'agent_type': self.agent_type,
            'status': 'active',
            'capabilities': self.capabilities,
            'metrics': self.metrics,
            'specifications_created': len(self.specifications),
            'active_designs': len(self.active_designs)
        }
    
    def run(self):
        """Main agent loop"""
        logger.info(f"AI Architect Agent starting...")
        logger.info(f"Agent ID: {self.agent_id}")
        logger.info(f"Capabilities: {', '.join(self.capabilities)}")
        
        # Test mode: Create sample specification
        if "--test" in sys.argv:
            logger.info("Running in test mode...")
            test_issue = {
                'id': 'test-001',
                'title': 'Create user authentication system with OAuth2',
                'body': '''We need a robust authentication system that supports:
                - User registration and login
                - OAuth2 integration with Google and GitHub
                - JWT token management
                - Password reset functionality
                - Two-factor authentication
                - User profile management
                
                The system should handle 10000 concurrent users and integrate with our existing PostgreSQL database.
                Performance requirement: Authentication should complete within 200ms.
                Security requirement: Must comply with OWASP standards.
                ''',
                'labels': ['feature', 'high-priority', 'security'],
                'assignees': ['ai-architect']
            }
            
            self.process_work_item(test_issue)
            logger.info("Test specification created successfully!")
            return
        
        # Main loop
        while True:
            try:
                # Check for new work items
                work_items = self.work_queue.get_work_items(
                    assignee=None,
                    status='pending',
                    work_type='feature'
                )
                
                for work_item in work_items:
                    if self.should_process_work_item(work_item):
                        self.process_work_item(work_item)
                
                # Update agent status
                self.communication_hub.update_agent_status(
                    self.agent_id,
                    status="active",
                    last_activity=datetime.now().isoformat()
                )
                
                # Log status
                if len(work_items) > 0:
                    logger.info(f"Processed {len(work_items)} work items")
                
                time.sleep(10)  # Check every 10 seconds
                
            except KeyboardInterrupt:
                logger.info("AI Architect Agent stopping...")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}", exc_info=True)
                time.sleep(30)  # Wait before retry


def main():
    """Main entry point"""
    agent = AIArchitectAgent()
    
    print("\n" + "="*80)
    print("AI ARCHITECT AGENT INITIALIZED")
    print("="*80)
    print(f"Agent ID: {agent.agent_id}")
    print(f"Capabilities: {len(agent.capabilities)} specialized skills")
    print(f"Architecture Patterns: {len(agent.architecture_patterns)} patterns available")
    print(f"Technology Database: {len(agent.tech_recommendations)} categories")
    print("="*80)
    print("Status: Ready to receive work from PM Workflow pipeline")
    print("Integration: Connected to Visual Forge AI -> PM Workflow")
    print("="*80 + "\n")
    
    agent.run()


if __name__ == "__main__":
    main()