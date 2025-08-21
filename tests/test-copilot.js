const axios = require('axios');

async function testCopilotGeneration() {
  console.log('Testing GitHub Copilot integration...\n');
  
  try {
    const response = await axios.post('http://localhost:5002/agent/ai-developer-agent-1/task', {
      taskId: 'test-copilot-001',
      task: 'Code a TypeScript function to validate email addresses',
      priority: 'high',
      context: {
        language: 'typescript',
        serverless: false,
        description: 'Create a robust email validation function with proper type checking and support for common email formats'
      }
    });
    
    console.log('Response Status:', response.data.status);
    console.log('Task ID:', response.data.taskId);
    
    if (response.data.result) {
      console.log('\n=== Generated Code Files ===');
      response.data.result.files.forEach(file => {
        console.log(`\nFile: ${file.path}`);
        console.log('Content Preview:', file.content.substring(0, 500) + '...');
      });
      
      if (response.data.result.tests.length > 0) {
        console.log('\n=== Generated Tests ===');
        response.data.result.tests.forEach(test => {
          console.log(`\nTest File: ${test.path}`);
          console.log('Content Preview:', test.content.substring(0, 300) + '...');
        });
      }
      
      console.log('\n=== Documentation ===');
      console.log(response.data.result.documentation);
    }
    
  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

testCopilotGeneration();