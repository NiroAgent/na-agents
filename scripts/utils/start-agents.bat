@echo off
echo Starting AI Agent System...

start "Architect Agent" cmd /k "npx ts-node src/agents/architect-agent.ts"
timeout /t 2 /nobreak > nul

start "Developer Agent" cmd /k "npx ts-node src/agents/developer-agent.ts"
timeout /t 2 /nobreak > nul

start "DevOps Agent" cmd /k "npx ts-node src/agents/devops-agent.ts"
timeout /t 2 /nobreak > nul

start "QA Agent" cmd /k "npx ts-node src/agents/qa-agent.ts"
timeout /t 2 /nobreak > nul

start "Manager Agent" cmd /k "npx ts-node src/agents/manager-agent.ts"

echo All agents started!
pause