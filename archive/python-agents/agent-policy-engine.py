#!/usr/bin/env python3
"""
Agent Policy Engine Integration
Integrates VF-Agent-Service Universal Policy Engine with SDLC agents
Creates role-based policies and knowledge base for agent standards
"""

import json
import sqlite3
import logging
import requests
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
from dataclasses import dataclass, asdict
import hashlib

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger('AgentPolicyEngine')

@dataclass
class AgentRole:
    """Agent role definition with policies"""
    role_id: str
    name: str
    description: str
    responsibilities: List[str]
    policies: List[str]
    knowledge_base_refs: List[str]
    standards: Dict[str, Any]
    risk_level: str
    approval_required: bool

@dataclass
class PolicyRule:
    """Policy rule for agents"""
    rule_id: str
    name: str
    description: str
    category: str
    severity: str
    pattern: str
    action: str
    mitigation: str
    applicable_roles: List[str]
    created_at: str
    updated_at: str

@dataclass
class KnowledgeBaseEntry:
    """Knowledge base entry for agent reference"""
    entry_id: str
    title: str
    content: str
    category: str
    tags: List[str]
    applicable_roles: List[str]
    source: str
    last_updated: str
    version: str

class AgentPolicyDatabase:
    def __init__(self, db_path: str = "agent_policies.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database with policy tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Agent roles table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS agent_roles (
                role_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                responsibilities TEXT,
                policies TEXT,
                knowledge_base_refs TEXT,
                standards TEXT,
                risk_level TEXT,
                approval_required BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Policy rules table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS policy_rules (
                rule_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                severity TEXT,
                pattern TEXT,
                action TEXT,
                mitigation TEXT,
                applicable_roles TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Knowledge base table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS knowledge_base (
                entry_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                category TEXT,
                tags TEXT,
                applicable_roles TEXT,
                source TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                version TEXT
            )
        ''')
        
        # Policy assessments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS policy_assessments (
                assessment_id TEXT PRIMARY KEY,
                agent_id TEXT,
                role_id TEXT,
                content_hash TEXT,
                risk_level INTEGER,
                allowed BOOLEAN,
                violations TEXT,
                suggestions TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info(f"Policy database initialized: {self.db_path}")
    
    def add_role(self, role: AgentRole):
        """Add agent role to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO agent_roles 
            (role_id, name, description, responsibilities, policies, knowledge_base_refs, 
             standards, risk_level, approval_required)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            role.role_id,
            role.name,
            role.description,
            json.dumps(role.responsibilities),
            json.dumps(role.policies),
            json.dumps(role.knowledge_base_refs),
            json.dumps(role.standards),
            role.risk_level,
            role.approval_required
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"Added role: {role.name}")
    
    def add_policy_rule(self, rule: PolicyRule):
        """Add policy rule to database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO policy_rules 
            (rule_id, name, description, category, severity, pattern, action, 
             mitigation, applicable_roles)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            rule.rule_id,
            rule.name,
            rule.description,
            rule.category,
            rule.severity,
            rule.pattern,
            rule.action,
            rule.mitigation,
            json.dumps(rule.applicable_roles)
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"Added policy rule: {rule.name}")
    
    def add_knowledge_entry(self, entry: KnowledgeBaseEntry):
        """Add knowledge base entry"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO knowledge_base 
            (entry_id, title, content, category, tags, applicable_roles, source, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            entry.entry_id,
            entry.title,
            entry.content,
            entry.category,
            json.dumps(entry.tags),
            json.dumps(entry.applicable_roles),
            entry.source,
            entry.version
        ))
        
        conn.commit()
        conn.close()
        logger.info(f"Added knowledge entry: {entry.title}")
    
    def get_role_policies(self, role_id: str) -> List[PolicyRule]:
        """Get all policies applicable to a role"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM policy_rules 
            WHERE applicable_roles LIKE ?
        ''', (f'%{role_id}%',))
        
        rows = cursor.fetchall()
        conn.close()
        
        policies = []
        for row in rows:
            policies.append(PolicyRule(
                rule_id=row[0],
                name=row[1],
                description=row[2] or "",
                category=row[3] or "",
                severity=row[4] or "",
                pattern=row[5] or "",
                action=row[6] or "",
                mitigation=row[7] or "",
                applicable_roles=json.loads(row[8] or "[]"),
                created_at=row[9] or "",
                updated_at=row[10] or ""
            ))
        
        return policies
    
    def get_role_knowledge(self, role_id: str) -> List[KnowledgeBaseEntry]:
        """Get knowledge base entries for a role"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT * FROM knowledge_base 
            WHERE applicable_roles LIKE ?
        ''', (f'%{role_id}%',))
        
        rows = cursor.fetchall()
        conn.close()
        
        entries = []
        for row in rows:
            entries.append(KnowledgeBaseEntry(
                entry_id=row[0],
                title=row[1],
                content=row[2] or "",
                category=row[3] or "",
                tags=json.loads(row[4] or "[]"),
                applicable_roles=json.loads(row[5] or "[]"),
                source=row[6] or "",
                last_updated=row[7] or "",
                version=row[8] or ""
            ))
        
        return entries

class AgentPolicyEngine:
    def __init__(self, vf_agent_service_url: str = "http://localhost:3001"):
        self.vf_service_url = vf_agent_service_url
        self.db = AgentPolicyDatabase()
        self.init_default_policies()
    
    def init_default_policies(self):
        """Initialize default agent roles and policies"""
        logger.info("Initializing default SDLC agent policies...")
        
        # Define SDLC agent roles
        roles = [
            AgentRole(
                role_id="completion_agent",
                name="Completion Agent",
                description="Completes partial implementations and missing components",
                responsibilities=[
                    "Complete partially implemented code",
                    "Add missing functionality", 
                    "Ensure code quality and standards",
                    "Integration testing"
                ],
                policies=[
                    "code_quality_standards",
                    "security_review_required",
                    "testing_mandatory"
                ],
                knowledge_base_refs=[
                    "coding_standards",
                    "design_patterns",
                    "testing_frameworks"
                ],
                standards={
                    "code_coverage": 80,
                    "documentation_required": True,
                    "peer_review": True
                },
                risk_level="medium",
                approval_required=False
            ),
            AgentRole(
                role_id="testing_agent",
                name="Testing Agent", 
                description="Creates comprehensive test suites and validates functionality",
                responsibilities=[
                    "Create unit tests",
                    "Create integration tests",
                    "Performance testing",
                    "Security testing"
                ],
                policies=[
                    "test_coverage_minimum",
                    "security_testing_required",
                    "performance_benchmarks"
                ],
                knowledge_base_refs=[
                    "testing_frameworks",
                    "security_testing",
                    "performance_testing"
                ],
                standards={
                    "test_coverage": 95,
                    "security_scan": True,
                    "load_testing": True
                },
                risk_level="low",
                approval_required=False
            ),
            AgentRole(
                role_id="devops_agent",
                name="DevOps Agent",
                description="Infrastructure, deployment, and operations automation",
                responsibilities=[
                    "Infrastructure setup",
                    "CI/CD pipeline creation",
                    "Monitoring setup",
                    "Security hardening"
                ],
                policies=[
                    "infrastructure_security",
                    "deployment_approval",
                    "monitoring_required"
                ],
                knowledge_base_refs=[
                    "infrastructure_standards",
                    "security_hardening",
                    "monitoring_best_practices"
                ],
                standards={
                    "security_scan": True,
                    "backup_strategy": True,
                    "monitoring": True
                },
                risk_level="high",
                approval_required=True
            ),
            AgentRole(
                role_id="security_agent",
                name="Security Agent",
                description="Security assessment and hardening",
                responsibilities=[
                    "Security vulnerability assessment",
                    "Code security review",
                    "Compliance checking",
                    "Security documentation"
                ],
                policies=[
                    "security_first",
                    "vulnerability_reporting",
                    "compliance_mandatory"
                ],
                knowledge_base_refs=[
                    "security_standards",
                    "compliance_frameworks",
                    "vulnerability_databases"
                ],
                standards={
                    "vulnerability_scan": True,
                    "compliance_check": True,
                    "security_documentation": True
                },
                risk_level="high",
                approval_required=True
            ),
            AgentRole(
                role_id="documentation_agent",
                name="Documentation Agent",
                description="Technical documentation and knowledge management",
                responsibilities=[
                    "API documentation",
                    "User guides",
                    "Technical specifications",
                    "Knowledge base maintenance"
                ],
                policies=[
                    "documentation_standards",
                    "accessibility_compliance",
                    "version_control"
                ],
                knowledge_base_refs=[
                    "documentation_templates",
                    "style_guides",
                    "accessibility_standards"
                ],
                standards={
                    "documentation_coverage": 90,
                    "accessibility_compliant": True,
                    "version_tracked": True
                },
                risk_level="low",
                approval_required=False
            ),
            AgentRole(
                role_id="dashboard_agent",
                name="Dashboard Agent",
                description="UI/UX development and dashboard maintenance", 
                responsibilities=[
                    "Dashboard development",
                    "UI component creation",
                    "User experience optimization",
                    "Frontend testing"
                ],
                policies=[
                    "ui_standards",
                    "accessibility_required",
                    "browser_compatibility"
                ],
                knowledge_base_refs=[
                    "ui_design_standards",
                    "accessibility_guidelines",
                    "frontend_frameworks"
                ],
                standards={
                    "accessibility_score": 95,
                    "browser_support": "modern",
                    "responsive_design": True
                },
                risk_level="medium",
                approval_required=False
            )
        ]
        
        # Add roles to database
        for role in roles:
            self.db.add_role(role)
        
        # Initialize policy rules
        self.init_policy_rules()
        
        # Initialize knowledge base
        self.init_knowledge_base()
    
    def init_policy_rules(self):
        """Initialize policy rules"""
        rules = [
            PolicyRule(
                rule_id="code_quality_001",
                name="Code Quality Standards",
                description="All code must meet quality standards",
                category="code_quality",
                severity="high",
                pattern=r"(TODO|FIXME|HACK)",
                action="warn",
                mitigation="Address TODO/FIXME comments before submission",
                applicable_roles=["completion_agent", "testing_agent"],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            ),
            PolicyRule(
                rule_id="security_001",
                name="No Hardcoded Secrets",
                description="Prevent hardcoded passwords and API keys",
                category="security",
                severity="critical",
                pattern=r"(password|api_key|secret)\s*=\s*['\"][^'\"]+['\"]",
                action="deny",
                mitigation="Use environment variables or secure vaults",
                applicable_roles=["completion_agent", "security_agent", "devops_agent"],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            ),
            PolicyRule(
                rule_id="testing_001",
                name="Test Coverage Minimum",
                description="Minimum test coverage requirements",
                category="testing",
                severity="medium",
                pattern=r"coverage.*[<].*80",
                action="warn",
                mitigation="Increase test coverage to at least 80%",
                applicable_roles=["testing_agent", "completion_agent"],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            ),
            PolicyRule(
                rule_id="documentation_001",
                name="Documentation Required",
                description="All public APIs must be documented",
                category="documentation",
                severity="medium",
                pattern=r"def\s+\w+\(.*\):\s*$",
                action="warn",
                mitigation="Add docstring to public functions",
                applicable_roles=["documentation_agent", "completion_agent"],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            ),
            PolicyRule(
                rule_id="devops_001",
                name="Infrastructure Security",
                description="Infrastructure must follow security standards",
                category="devops",
                severity="high",
                pattern=r"(expose|public).*port.*22",
                action="deny",
                mitigation="Do not expose SSH port publicly",
                applicable_roles=["devops_agent", "security_agent"],
                created_at=datetime.now().isoformat(),
                updated_at=datetime.now().isoformat()
            )
        ]
        
        for rule in rules:
            self.db.add_policy_rule(rule)
    
    def init_knowledge_base(self):
        """Initialize knowledge base entries"""
        entries = [
            KnowledgeBaseEntry(
                entry_id="kb_001",
                title="Python Coding Standards",
                content="""
# Python Coding Standards for SDLC Agents

## Style Guide
- Follow PEP 8 for Python code style
- Use type hints for all function parameters and return values
- Maximum line length: 88 characters (Black formatter standard)

## Documentation
- All public functions must have docstrings
- Use Google-style docstrings
- Include examples for complex functions

## Testing
- Minimum 80% test coverage
- Use pytest for testing framework
- Include both unit and integration tests

## Security
- Never hardcode secrets or API keys
- Use environment variables for configuration
- Validate all inputs
- Use secure random generators for tokens
                """,
                category="coding_standards",
                tags=["python", "style", "testing", "security"],
                applicable_roles=["completion_agent", "testing_agent"],
                source="internal_standards",
                last_updated=datetime.now().isoformat(),
                version="1.0"
            ),
            KnowledgeBaseEntry(
                entry_id="kb_002",
                title="Security Testing Guidelines",
                content="""
# Security Testing Guidelines

## Vulnerability Assessment
- OWASP Top 10 compliance required
- Static code analysis with bandit
- Dependency vulnerability scanning
- Regular penetration testing

## Authentication & Authorization
- Multi-factor authentication where applicable
- Role-based access control (RBAC)
- JWT token security best practices
- Session management

## Data Protection
- Encryption at rest and in transit
- PII data handling procedures
- Data retention policies
- GDPR compliance where applicable

## Infrastructure Security
- Container security scanning
- Network security policies
- Infrastructure as Code security
- Monitoring and alerting
                """,
                category="security_testing",
                tags=["security", "testing", "owasp", "compliance"],
                applicable_roles=["security_agent", "testing_agent", "devops_agent"],
                source="security_team",
                last_updated=datetime.now().isoformat(),
                version="1.0"
            ),
            KnowledgeBaseEntry(
                entry_id="kb_003",
                title="CI/CD Pipeline Standards",
                content="""
# CI/CD Pipeline Standards

## Pipeline Stages
1. Code Quality Checks (linting, formatting)
2. Security Scanning (SAST, dependency check)
3. Unit Tests (minimum 80% coverage)
4. Integration Tests
5. Build Artifacts
6. Deploy to Staging
7. End-to-End Tests
8. Security Testing
9. Performance Testing
10. Deploy to Production (with approval)

## Quality Gates
- All tests must pass
- Code coverage above threshold
- Security scans pass
- Performance benchmarks met
- Manual approval for production

## Monitoring
- Application performance monitoring
- Error tracking and alerting
- Infrastructure monitoring
- Security monitoring
                """,
                category="devops",
                tags=["cicd", "deployment", "monitoring", "quality"],
                applicable_roles=["devops_agent", "testing_agent"],
                source="devops_team",
                last_updated=datetime.now().isoformat(),
                version="1.0"
            )
        ]
        
        for entry in entries:
            self.db.add_knowledge_entry(entry)
    
    def assess_agent_action(self, agent_id: str, role_id: str, content: str) -> Dict[str, Any]:
        """Assess agent action against policies using VF Policy Engine"""
        # Get role-specific policies
        policies = self.db.get_role_policies(role_id)
        knowledge = self.db.get_role_knowledge(role_id)
        
        # Prepare assessment context
        context = {
            "agent_id": agent_id,
            "role_id": role_id,
            "platform": "desktop",  # SDLC agents run on desktop
            "userTier": "premium",  # Internal agents have premium access
            "mode": "agent"
        }
        
        # Local policy assessment
        local_assessment = self._assess_local_policies(content, policies, context)
        
        # Try to get VF Policy Engine assessment
        vf_assessment = self._get_vf_policy_assessment(content, context)
        
        # Combine assessments
        combined_assessment = self._combine_assessments(local_assessment, vf_assessment)
        
        # Log assessment
        self._log_assessment(agent_id, role_id, content, combined_assessment)
        
        return combined_assessment
    
    def _assess_local_policies(self, content: str, policies: List[PolicyRule], context: Dict[str, Any]) -> Dict[str, Any]:
        """Assess content against local policies"""
        violations = []
        suggestions = []
        risk_level = 1
        
        for policy in policies:
            if self._check_policy_pattern(content, policy.pattern):
                violations.append({
                    "policy": policy.name,
                    "severity": policy.severity,
                    "description": policy.description,
                    "mitigation": policy.mitigation
                })
                
                # Update risk level based on severity
                severity_risk = {"low": 1, "medium": 2, "high": 3, "critical": 4}
                risk_level = max(risk_level, severity_risk.get(policy.severity, 1))
                
                suggestions.append(policy.mitigation)
        
        # Determine if action is allowed
        allowed = risk_level < 4 and (risk_level < 3 or context.get("approval_required", False))
        
        return {
            "source": "local_policies",
            "allowed": allowed,
            "risk_level": risk_level,
            "violations": violations,
            "suggestions": suggestions,
            "compliance_level": max(0, 100 - (len(violations) * 20))
        }
    
    def _get_vf_policy_assessment(self, content: str, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Get assessment from VF Policy Engine"""
        try:
            response = requests.post(
                f"{self.vf_service_url}/api/policy/assess",
                json={
                    "content": content,
                    "context": context
                },
                timeout=5
            )
            
            if response.status_code == 200:
                return {
                    "source": "vf_policy_engine",
                    **response.json()
                }
        except Exception as e:
            logger.warning(f"VF Policy Engine unavailable: {e}")
        
        return None
    
    def _combine_assessments(self, local: Dict[str, Any], vf: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Combine local and VF policy assessments"""
        if not vf:
            return local
        
        # Take the more restrictive assessment
        combined = {
            "allowed": local["allowed"] and vf.get("allowed", True),
            "risk_level": max(local["risk_level"], vf.get("riskLevel", 1)),
            "local_assessment": local,
            "vf_assessment": vf,
            "violations": local["violations"] + vf.get("detectedRisks", []),
            "suggestions": list(set(local["suggestions"] + vf.get("suggestions", []))),
            "compliance_level": min(local["compliance_level"], vf.get("complianceLevel", 100)),
            "audit_id": vf.get("auditId", f"local_{datetime.now().timestamp()}")
        }
        
        return combined
    
    def _check_policy_pattern(self, content: str, pattern: str) -> bool:
        """Check if content matches policy pattern"""
        import re
        try:
            return bool(re.search(pattern, content, re.IGNORECASE))
        except re.error:
            logger.warning(f"Invalid regex pattern: {pattern}")
            return False
    
    def _log_assessment(self, agent_id: str, role_id: str, content: str, assessment: Dict[str, Any]):
        """Log policy assessment to database"""
        conn = sqlite3.connect(self.db.db_path)
        cursor = conn.cursor()
        
        content_hash = hashlib.sha256(content.encode()).hexdigest()[:16]
        
        cursor.execute('''
            INSERT INTO policy_assessments 
            (assessment_id, agent_id, role_id, content_hash, risk_level, allowed, violations, suggestions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            assessment.get("audit_id", f"local_{datetime.now().timestamp()}"),
            agent_id,
            role_id,
            content_hash,
            assessment["risk_level"],
            assessment["allowed"],
            json.dumps(assessment["violations"]),
            json.dumps(assessment["suggestions"])
        ))
        
        conn.commit()
        conn.close()
    
    def get_role_guidelines(self, role_id: str) -> Dict[str, Any]:
        """Get comprehensive guidelines for an agent role"""
        policies = self.db.get_role_policies(role_id)
        knowledge = self.db.get_role_knowledge(role_id)
        
        return {
            "role_id": role_id,
            "policies": [asdict(p) for p in policies],
            "knowledge_base": [asdict(k) for k in knowledge],
            "last_updated": datetime.now().isoformat()
        }
    
    def update_policy(self, rule_id: str, updates: Dict[str, Any]):
        """Update existing policy rule"""
        conn = sqlite3.connect(self.db.db_path)
        cursor = conn.cursor()
        
        # Build dynamic update query
        update_fields = []
        values = []
        
        for field, value in updates.items():
            if field in ["name", "description", "category", "severity", "pattern", "action", "mitigation"]:
                update_fields.append(f"{field} = ?")
                values.append(value)
            elif field == "applicable_roles":
                update_fields.append("applicable_roles = ?")
                values.append(json.dumps(value))
        
        if update_fields:
            update_fields.append("updated_at = ?")
            values.append(datetime.now().isoformat())
            values.append(rule_id)
            
            query = f"UPDATE policy_rules SET {', '.join(update_fields)} WHERE rule_id = ?"
            cursor.execute(query, values)
            conn.commit()
        
        conn.close()
        logger.info(f"Updated policy rule: {rule_id}")

def main():
    """Initialize and test the agent policy engine"""
    print("🔐 Initializing Agent Policy Engine with VF Integration...")
    
    engine = AgentPolicyEngine()
    
    print("\n📋 Testing policy assessment...")
    
    # Test completion agent code
    test_code = '''
def process_user_data(user_input):
    password = "hardcoded_secret_123"  # This should trigger security policy
    # TODO: Implement proper validation
    return user_input.upper()
    '''
    
    assessment = engine.assess_agent_action(
        agent_id="test_completion_agent",
        role_id="completion_agent", 
        content=test_code
    )
    
    print(f"   Assessment Result: {'✅ ALLOWED' if assessment['allowed'] else '❌ DENIED'}")
    print(f"   Risk Level: {assessment['risk_level']}/4")
    print(f"   Violations: {len(assessment['violations'])}")
    
    if assessment['violations']:
        print("   🚨 Policy Violations:")
        for violation in assessment['violations']:
            print(f"      • {violation.get('policy', violation.get('description', 'Unknown'))}")
    
    if assessment['suggestions']:
        print("   💡 Suggestions:")
        for suggestion in assessment['suggestions'][:3]:
            print(f"      • {suggestion}")
    
    print(f"\n📚 Knowledge Base Entries:")
    guidelines = engine.get_role_guidelines("completion_agent")
    for kb in guidelines['knowledge_base'][:2]:
        print(f"   • {kb['title']} - {kb['category']}")
    
    print(f"\n🎯 Policy Rules for Completion Agent:")
    for policy in guidelines['policies'][:3]:
        print(f"   • {policy['name']} ({policy['severity']})")
    
    print(f"\n📊 Database Status:")
    print(f"   • Database: agent_policies.db")
    print(f"   • Tables: agent_roles, policy_rules, knowledge_base, policy_assessments")
    print(f"   • VF Integration: {'✅ Available' if engine.vf_service_url else '❌ Not configured'}")
    
    print(f"\n🔗 Integration Points:")
    print(f"   • GitHub Issues: Can reference policy violations")
    print(f"   • Agent Coordination: Policy checks before task execution")
    print(f"   • Dashboard: Policy compliance monitoring")
    print(f"   • VF Policy Engine: Cross-platform policy enforcement")

if __name__ == "__main__":
    main()
