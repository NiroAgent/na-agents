#!/bin/bash
# Fix the task.toLowerCase() bug in all agents

cd ~/Projects/NiroAgent/na-agents/src/agents

# Backup original files
for file in *.ts; do
  cp "$file" "$file.backup"
done

# Fix architect-agent.ts
sed -i 's/payload\.task\.toLowerCase()/\(payload\.task || ""\)\.toLowerCase()/g' architect-agent.ts

# Fix developer-agent.ts  
sed -i 's/payload\.task\.toLowerCase()/\(payload\.task || ""\)\.toLowerCase()/g' developer-agent.ts

# Fix devops-agent.ts
sed -i 's/payload\.task\.toLowerCase()/\(payload\.task || ""\)\.toLowerCase()/g' devops-agent.ts

# Fix manager-agent.ts
sed -i 's/payload\.task\.toLowerCase()/\(payload\.task || ""\)\.toLowerCase()/g' manager-agent.ts
sed -i 's/const task = payload\.task\.toLowerCase()/const task = \(payload\.task || ""\)\.toLowerCase()/g' manager-agent.ts

# Fix qa-agent.ts
sed -i 's/payload\.task\.toLowerCase()/\(payload\.task || ""\)\.toLowerCase()/g' qa-agent.ts

echo "✅ Fixed task.toLowerCase() bug in all agents"
echo "Backup files created with .backup extension"