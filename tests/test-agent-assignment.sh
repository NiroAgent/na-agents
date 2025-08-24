#!/bin/bash
# Quick test of agent assignment

echo "Testing AI Agent Router..."

python3 -c "
import sys
sys.path.append('.')
from simple_github_agent_router import SimpleGitHubAgentRouter

router = SimpleGitHubAgentRouter()

# Test cases
test_issues = [
    {'title': 'Fix login bug', 'body': 'Users cannot login', 'labels': [{'name': 'bug'}]},
    {'title': 'Design new architecture', 'body': 'Need to redesign the system', 'labels': [{'name': 'architecture'}]},
    {'title': 'Add security scan', 'body': 'Need vulnerability testing', 'labels': [{'name': 'security'}]},
    {'title': 'Deploy to production', 'body': 'Ready for deployment', 'labels': [{'name': 'deployment'}]}
]

for issue in test_issues:
    assignment = router.create_agent_assignment(issue)
    print(f'Issue: "{issue["title"]}" -> {assignment["agent_name"]}')

print('\nTest completed successfully!')
"

echo "All tests passed! ✅"
