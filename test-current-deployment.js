// Simple JavaScript test for current deployment status
// Tests endpoints without requiring complex environment setup

const https = require('https');
const http = require('http');

console.log('🧪 NA-Agents Deployment Test');
console.log('============================\n');

// Function to test HTTP endpoint
function testEndpoint(url, description) {
    return new Promise((resolve) => {
        const client = url.startsWith('https:') ? https : http;
        const timeout = 5000; // 5 second timeout
        
        const req = client.get(url, { timeout }, (res) => {
            console.log(`✅ ${description}: HTTP ${res.statusCode}`);
            resolve(true);
        });
        
        req.on('error', (err) => {
            console.log(`❌ ${description}: ${err.message}`);
            resolve(false);
        });
        
        req.on('timeout', () => {
            console.log(`❌ ${description}: Timeout`);
            req.destroy();
            resolve(false);
        });
    });
}

// Test function for all agents on a specific host
async function testAllAgents(baseUrl, description) {
    console.log(`\n🚀 Testing ${description}`);
    console.log('----------------------------------------');
    
    const agents = [
        { name: 'Architect', port: 5001 },
        { name: 'Developer', port: 5002 },
        { name: 'DevOps', port: 5003 },
        { name: 'QA', port: 5004 },
        { name: 'Manager', port: 5005 }
    ];
    
    let onlineCount = 0;
    
    for (const agent of agents) {
        const url = `${baseUrl}:${agent.port}/health`;
        const isOnline = await testEndpoint(url, `${agent.name} (port ${agent.port})`);
        if (isOnline) onlineCount++;
    }
    
    console.log(`\nResult: ${onlineCount}/5 agents online`);
    
    if (onlineCount === 5) {
        console.log('\n🎉 SUCCESS! All agents are online!');
        console.log(`\n📋 Agent URLs for ${description}:`);
        agents.forEach(agent => {
            console.log(`  ${agent.name}: ${baseUrl}:${agent.port}`);
        });
        return true;
    }
    
    return false;
}

// Main test execution
async function runTests() {
    console.log('Starting deployment verification...\n');
    
    // Test potential deployment locations
    const testLocations = [
        { url: 'http://localhost', desc: 'Local Development' },
        { url: 'http://127.0.0.1', desc: 'Local Fallback' },
        { url: 'http://98.81.93.132', desc: 'EC2 Instance #1' },
        { url: 'http://35.174.174.116', desc: 'EC2 Instance #2' },
        { url: 'https://dev.agents.visualforge.ai', desc: 'Development DNS' }
    ];
    
    let foundWorking = false;
    
    for (const location of testLocations) {
        const success = await testAllAgents(location.url, location.desc);
        if (success) {
            foundWorking = true;
            break;
        }
    }
    
    if (!foundWorking) {
        console.log('\n❌ DEPLOYMENT VERIFICATION FAILED');
        console.log('\n💡 Troubleshooting Information:');
        console.log('  1. Check GitHub Actions workflow status');
        console.log('  2. Verify EC2 instance is running and accessible');
        console.log('  3. Ensure TypeScript agents are deployed and started');
        console.log('  4. Check security groups allow ports 5001-5005');
        console.log('  5. Wait for DNS propagation if using domain names');
        console.log('\n🔗 GitHub Actions: https://github.com/NiroAgent/na-agents/actions');
    }
    
    // Test additional services
    console.log('\n🔍 Additional Service Tests');
    console.log('---------------------------');
    
    // Test dashboard API
    await testEndpoint('http://localhost:4001/api/dashboard/agents', 'Dashboard API (localhost:4001)');
    await testEndpoint('http://localhost:4002/api/dashboard/agents', 'Dashboard API (localhost:4002)');
    
    // Test chat interface
    await testEndpoint('http://localhost:7000/health', 'Chat Interface (localhost:7000)');
    
    // Test GitHub service
    await testEndpoint('http://localhost:6000/health', 'GitHub Service (localhost:6000)');
    
    console.log('\n✅ Deployment test completed.');
}

// Run the tests
runTests().catch(console.error);