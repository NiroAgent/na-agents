# Prompt to Give Claude in WSL2

## Steps:
1. Open WSL2 terminal
2. Run: `cd ~/Projects/NiroAgent/na-agents`
3. Run: `claude`
4. Give this prompt:

---

## PROMPT:

Please continue working on the AI Agent System. Read the AGENT_TASKS.md file in the current directory for the full task list and current status.

Start by:
1. Reading AGENT_TASKS.md to understand all tasks
2. Fixing the critical toLowerCase() bug in all agent files
3. Building the Dashboard UI at port 4001
4. Testing the complete system

The project is in ~/Projects/NiroAgent/na-agents and all work should be done here. This is a TypeScript/Node.js multi-agent system with 5 agents (Architect, Developer, DevOps, QA, Manager) that need to work together with a central dashboard.

Make sure to test thoroughly after each major change.