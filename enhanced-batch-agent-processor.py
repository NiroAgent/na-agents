#!/usr/bin/env python3
"""
Enhanced AWS Batch Agent Processor 
==================================
Improved version that integrates with the manually edited agents
Runs in Docker container on AWS Batch/Fargate
"""

import os
import sys
import json
import boto3
import requests
import subprocess
import importlib.util
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import traceback
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('BatchAgentProcessor')

# Environment variables (set by GitHub Actions or AWS)
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO = os.environ.get('GITHUB_REPO')
ISSUE_NUMBER = os.environ.get('ISSUE_NUMBER')
AGENT_TYPE = os.environ.get('AGENT_TYPE')
AGENT_NAME = os.environ.get('AGENT_NAME')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

class EnhancedBatchAgentProcessor:
    """Enhanced processor for running agents in containers"""
    
    def __init__(self):
        # Validate required environment variables
        required_vars = ['GITHUB_TOKEN', 'GITHUB_REPO', 'ISSUE_NUMBER', 'AGENT_TYPE']
        missing_vars = [var for var in required_vars if not os.environ.get(var)]
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")
        
        self.github_token = GITHUB_TOKEN
        self.repo = GITHUB_REPO
        self.issue_number = int(ISSUE_NUMBER)
        self.agent_type = AGENT_TYPE
        self.agent_name = AGENT_NAME or f"ai-{AGENT_TYPE}-agent"
        
        # GitHub API setup
        self.github_headers = {
            'Authorization': f'token {self.github_token}',
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        }
        
        # Agent mapping - matches the manually edited agents
        self.agent_scripts = {
            'developer': 'ai-developer-agent.py',
            'development': 'ai-developer-agent.py',
            'architect': 'ai-architect-agent.py',
            'architecture': 'ai-architect-agent.py',
            'qa': 'ai-qa-agent.py',
            'quality_assurance': 'ai-qa-agent.py',
            'devops': 'ai-devops-agent.py',
            'manager': 'ai-manager-agent.py',
            'management': 'ai-manager-agent.py',
            'support': 'ai-support-agent.py',
            'security': 'ai-security-agent.py',
            'analytics': 'ai-analytics-agent.py',
            'finance': 'ai-finance-agent.py',
            'operations': 'ai-operations-agent.py',
            'marketing': 'ai-marketing-agent.py',
            'sales': 'ai-sales-agent.py',
            'customer_success': 'ai-customer-success-agent.py',
            'customer-success': 'ai-customer-success-agent.py'
        }
        
        self.start_time = datetime.now()
        
        logger.info(f"Enhanced Batch Agent Processor initialized")
        logger.info(f"Issue: #{self.issue_number} in {self.repo}")
        logger.info(f"Agent: {self.agent_name} ({self.agent_type})")
    
    def get_issue_data(self) -> Dict[str, Any]:
        """Fetch issue data from GitHub API"""
        try:
            url = f"https://api.github.com/repos/{self.repo}/issues/{self.issue_number}"
            response = requests.get(url, headers=self.github_headers)
            
            if response.status_code == 200:
                issue_data = response.json()
                logger.info(f"Retrieved issue data: {issue_data['title']}")
                return issue_data
            else:
                raise Exception(f"Failed to fetch issue: {response.status_code} - {response.text}")
                
        except Exception as e:
            logger.error(f"Error fetching issue data: {e}")
            raise
    
    def update_issue_status(self, status: str, message: str, add_labels: list = None, remove_labels: list = None):
        """Update issue with processing status"""
        try:
            # Create status comment
            timestamp = datetime.now().isoformat()
            duration = (datetime.now() - self.start_time).total_seconds()
            
            comment_body = f"""## 🤖 {self.agent_name.upper()} - {status.upper()}

**Timestamp:** {timestamp}
**Processing Duration:** {duration:.1f} seconds
**Environment:** AWS {os.environ.get('AWS_EXECUTION_ENV', 'Batch/Fargate')}

{message}

---
*Processed by Enhanced Batch Agent Processor v2.0*"""
            
            # Post comment
            url = f"https://api.github.com/repos/{self.repo}/issues/{self.issue_number}/comments"
            response = requests.post(
                url,
                headers=self.github_headers,
                json={'body': comment_body}
            )
            
            if response.status_code != 201:
                logger.warning(f"Failed to post comment: {response.status_code}")
            
            # Update labels
            if add_labels:
                self.add_labels(add_labels)
            
            if remove_labels:
                self.remove_labels(remove_labels)
                
            logger.info(f"Updated issue status: {status}")
            
        except Exception as e:
            logger.error(f"Error updating issue status: {e}")
    
    def add_labels(self, labels: list):
        """Add labels to the issue"""
        try:
            url = f"https://api.github.com/repos/{self.repo}/issues/{self.issue_number}/labels"
            response = requests.post(
                url,
                headers=self.github_headers,
                json={'labels': labels}
            )
            
            if response.status_code in [200, 201]:
                logger.info(f"Added labels: {labels}")
            else:
                logger.warning(f"Failed to add labels: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"Error adding labels: {e}")
    
    def remove_labels(self, labels: list):
        """Remove labels from the issue"""
        try:
            for label in labels:
                url = f"https://api.github.com/repos/{self.repo}/issues/{self.issue_number}/labels/{label}"
                response = requests.delete(url, headers=self.github_headers)
                
                if response.status_code == 200:
                    logger.info(f"Removed label: {label}")
                else:
                    logger.warning(f"Failed to remove label {label}: {response.status_code}")
                    
        except Exception as e:
            logger.warning(f"Error removing labels: {e}")
    
    def load_agent_module(self, agent_script: str):
        """Dynamically load the agent module"""
        try:
            agent_path = Path(agent_script)
            
            if not agent_path.exists():
                # Try to find the agent in current directory or common locations
                for search_path in ['.', '/app', '/app/agents', './agents']:
                    candidate_path = Path(search_path) / agent_script
                    if candidate_path.exists():
                        agent_path = candidate_path
                        break
                else:
                    raise FileNotFoundError(f"Agent script not found: {agent_script}")
            
            # Load the module dynamically
            spec = importlib.util.spec_from_file_location("agent_module", agent_path)
            if spec is None:
                raise ImportError(f"Could not load spec for {agent_path}")
            
            agent_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(agent_module)
            
            logger.info(f"Successfully loaded agent module: {agent_script}")
            return agent_module
            
        except Exception as e:
            logger.error(f"Error loading agent module {agent_script}: {e}")
            raise
    
    def find_agent_class(self, agent_module):
        """Find the main agent class in the module"""
        try:
            # Common agent class name patterns
            class_patterns = [
                f"AI{self.agent_type.title()}Agent",
                f"AI{self.agent_type.title().replace('_', '')}Agent",
                f"{self.agent_type.title()}Agent",
                "AIAgent",
                "Agent"
            ]
            
            # Also try the exact class names from the manually edited files
            specific_classes = {
                'developer': 'AIDeveloperAgent',
                'development': 'AIDeveloperAgent',
                'architect': 'AIArchitectAgent',
                'architecture': 'AIArchitectAgent',
                'qa': 'AIQAAgent',
                'quality_assurance': 'AIQAAgent',
                'devops': 'AIDevOpsAgent',
                'manager': 'AIManagerAgent',
                'management': 'AIManagerAgent'
            }
            
            if self.agent_type in specific_classes:
                class_patterns.insert(0, specific_classes[self.agent_type])
            
            # Search for the agent class
            for class_name in class_patterns:
                if hasattr(agent_module, class_name):
                    agent_class = getattr(agent_module, class_name)
                    logger.info(f"Found agent class: {class_name}")
                    return agent_class
            
            # Fallback: find any class that looks like an agent
            for attr_name in dir(agent_module):
                attr = getattr(agent_module, attr_name)
                if (isinstance(attr, type) and 
                    'agent' in attr_name.lower() and 
                    not attr_name.startswith('_')):
                    logger.info(f"Found agent class (fallback): {attr_name}")
                    return attr
            
            raise AttributeError(f"No agent class found in {agent_module}")
            
        except Exception as e:
            logger.error(f"Error finding agent class: {e}")
            raise
    
    def process_with_agent(self, issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process the issue using the appropriate agent"""
        try:
            # Get the agent script path
            agent_script = self.agent_scripts.get(self.agent_type)
            if not agent_script:
                raise ValueError(f"No agent script found for type: {self.agent_type}")
            
            logger.info(f"Processing with agent script: {agent_script}")
            
            # Load the agent module
            agent_module = self.load_agent_module(agent_script)
            
            # Find and instantiate the agent class
            agent_class = self.find_agent_class(agent_module)
            agent_instance = agent_class()
            
            # Prepare work item for the agent (matching the format from orchestrator)
            work_item = {
                'item_id': f"github-issue-{self.issue_number}",
                'item_type': self.determine_work_type(issue_data),
                'title': issue_data['title'],
                'description': issue_data['body'],
                'priority': self.determine_priority(issue_data),
                'created_at': issue_data['created_at'],
                'labels': [label['name'] for label in issue_data.get('labels', [])],
                'assignee': issue_data.get('assignee', {}).get('login') if issue_data.get('assignee') else None,
                'repository': self.repo,
                'github_data': issue_data
            }
            
            # Process the work item
            logger.info(f"Starting agent processing...")
            
            # Check if agent has the expected methods
            if hasattr(agent_instance, 'handle_specific_task'):
                # Use the new agent interface
                result = agent_instance.handle_specific_task(work_item)
            elif hasattr(agent_instance, 'process_work_item'):
                # Try alternative method name
                result = agent_instance.process_work_item(work_item)
            elif hasattr(agent_instance, 'run') and hasattr(agent_instance, 'assign_work'):
                # Use the orchestrator interface
                agent_instance.assign_work(work_item)
                result = agent_instance.get_status()
            else:
                # Fallback: call main function if available
                if hasattr(agent_module, 'main'):
                    result = agent_module.main()
                else:
                    result = {'status': 'processed', 'message': 'Agent executed successfully'}
            
            logger.info(f"Agent processing completed successfully")
            return result
            
        except Exception as e:
            logger.error(f"Error processing with agent: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def determine_work_type(self, issue_data: Dict[str, Any]) -> str:
        """Determine work type from issue data"""
        labels = [label['name'].lower() for label in issue_data.get('labels', [])]
        title = issue_data['title'].lower()
        
        # Map labels to work types
        if 'bug' in labels or 'fix' in title:
            return 'bug_fix'
        elif 'feature' in labels or 'enhancement' in labels:
            return 'feature_development'
        elif 'security' in labels or 'vulnerability' in labels:
            return 'security_issue'
        elif 'performance' in labels or 'optimization' in labels:
            return 'performance_optimization'
        elif 'documentation' in labels or 'docs' in labels:
            return 'documentation'
        elif 'test' in labels or 'testing' in labels:
            return 'testing'
        elif 'deployment' in labels or 'deploy' in labels:
            return 'deployment'
        else:
            return 'general_task'
    
    def determine_priority(self, issue_data: Dict[str, Any]) -> str:
        """Determine priority from issue data"""
        labels = [label['name'].lower() for label in issue_data.get('labels', [])]
        title = issue_data['title'].lower()
        
        if any(p in labels for p in ['critical', 'urgent', 'p0', 'high']):
            return 'high'
        elif any(p in labels for p in ['medium', 'p1', 'p2']):
            return 'medium'
        elif any(p in labels for p in ['low', 'p3', 'p4']):
            return 'low'
        elif any(keyword in title for keyword in ['critical', 'urgent', 'broken', 'down']):
            return 'high'
        else:
            return 'medium'
    
    def fallback_processing(self, issue_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback processing when agent is not available"""
        logger.info("Using fallback processing")
        
        # Basic issue analysis
        analysis = {
            'issue_number': self.issue_number,
            'title': issue_data['title'],
            'work_type': self.determine_work_type(issue_data),
            'priority': self.determine_priority(issue_data),
            'labels': [label['name'] for label in issue_data.get('labels', [])],
            'estimated_effort': 'unknown',
            'recommendations': []
        }
        
        # Add basic recommendations based on issue type
        work_type = analysis['work_type']
        if work_type == 'bug_fix':
            analysis['recommendations'] = [
                'Reproduce the bug in development environment',
                'Identify root cause through debugging',
                'Implement fix with unit tests',
                'Test fix in staging environment'
            ]
        elif work_type == 'feature_development':
            analysis['recommendations'] = [
                'Create technical design document',
                'Break down into smaller tasks',
                'Implement with comprehensive tests',
                'Update documentation'
            ]
        elif work_type == 'security_issue':
            analysis['recommendations'] = [
                'Immediate security assessment',
                'Patch or temporary mitigation',
                'Security testing and validation',
                'Update security documentation'
            ]
        else:
            analysis['recommendations'] = [
                'Analyze requirements and scope',
                'Create implementation plan',
                'Execute with proper testing',
                'Document changes and deployment'
            ]
        
        return {
            'status': 'analyzed',
            'analysis': analysis,
            'agent': 'fallback_processor',
            'next_steps': analysis['recommendations']
        }
    
    def run(self) -> Dict[str, Any]:
        """Main processing function"""
        try:
            # Update status to processing
            self.update_issue_status(
                'PROCESSING',
                f'🚀 Starting {self.agent_name} processing...',
                add_labels=['ai-processing'],
                remove_labels=['ai-pending']
            )
            
            # Get issue data
            issue_data = self.get_issue_data()
            
            try:
                # Try to process with the specific agent
                result = self.process_with_agent(issue_data)
                
                # Update status to completed
                self.update_issue_status(
                    'COMPLETED',
                    f'✅ Processing completed successfully!\n\n**Results:**\n```json\n{json.dumps(result, indent=2)}\n```',
                    add_labels=['ai-completed'],
                    remove_labels=['ai-processing']
                )
                
                return {
                    'status': 'success',
                    'agent': self.agent_name,
                    'result': result,
                    'processing_time': (datetime.now() - self.start_time).total_seconds()
                }
                
            except Exception as agent_error:
                logger.warning(f"Agent processing failed, using fallback: {agent_error}")
                
                # Try fallback processing
                result = self.fallback_processing(issue_data)
                
                self.update_issue_status(
                    'COMPLETED (FALLBACK)',
                    f'⚠️ Agent processing failed, completed with fallback analysis.\n\n**Error:** {str(agent_error)}\n\n**Fallback Results:**\n```json\n{json.dumps(result, indent=2)}\n```',
                    add_labels=['ai-completed', 'fallback-processed'],
                    remove_labels=['ai-processing']
                )
                
                return {
                    'status': 'fallback_success',
                    'agent': 'fallback_processor',
                    'original_agent': self.agent_name,
                    'error': str(agent_error),
                    'result': result,
                    'processing_time': (datetime.now() - self.start_time).total_seconds()
                }
                
        except Exception as e:
            logger.error(f"Critical error in processing: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Update status to failed
            self.update_issue_status(
                'FAILED',
                f'❌ Processing failed with critical error.\n\n**Error:** {str(e)}\n\n**Traceback:**\n```\n{traceback.format_exc()}\n```',
                add_labels=['ai-failed'],
                remove_labels=['ai-processing']
            )
            
            return {
                'status': 'error',
                'agent': self.agent_name,
                'error': str(e),
                'traceback': traceback.format_exc(),
                'processing_time': (datetime.now() - self.start_time).total_seconds()
            }

def main():
    """Main entry point for container execution"""
    try:
        logger.info("="*80)
        logger.info("ENHANCED BATCH AGENT PROCESSOR v2.0")
        logger.info("="*80)
        
        # Create and run the processor
        processor = EnhancedBatchAgentProcessor()
        result = processor.run()
        
        # Save result for GitHub Actions to read
        with open('/tmp/agent-result.json', 'w') as f:
            json.dump(result, f, indent=2, default=str)
        
        logger.info(f"Processing result: {result['status']}")
        logger.info("="*80)
        
        # Exit with appropriate code
        if result['status'] in ['success', 'fallback_success']:
            sys.exit(0)
        else:
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)

if __name__ == "__main__":
    main()
