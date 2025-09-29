#!/usr/bin/env node

const { MCPClient } = require('./claude-hooks/utilities/mcp-client.js');

async function testMCPClient() {
    console.log('Testing fixed MCP client...\n');

    const client = new MCPClient(['uv', 'run', 'memory', 'server'], {
        workingDir: '/Users/linuxbabe/mcp-memory-service',
        connectionTimeout: 10000,
        toolCallTimeout: 10000
    });

    try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✅ Successfully connected!');

        // Test calling a tool
        console.log('\nCalling check_database_health...');
        const health = await client.callTool('check_database_health', {});
        console.log('Health status:', health);

        // Disconnect
        await client.disconnect();
        console.log('\n✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

testMCPClient();