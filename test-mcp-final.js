#!/usr/bin/env node

const { MCPClient } = require('./claude-hooks/utilities/mcp-client.js');

async function testMCPClient() {
    console.log('Testing MCP client end-to-end...\n');

    const client = new MCPClient(['uv', 'run', 'memory', 'server'], {
        workingDir: '/Users/linuxbabe/mcp-memory-service',
        connectionTimeout: 15000,
        toolCallTimeout: 15000
    });

    try {
        console.log('1. Attempting to connect...');
        await client.connect();
        console.log('✅ Successfully connected!\n');

        // Test storing a memory
        console.log('2. Storing a test memory...');
        const storeResult = await client.callTool('store_memory', {
            content: 'Test memory from MCP client hook integration test',
            metadata: {
                tags: ['test', 'mcp-client', 'integration'],
                type: 'test'
            }
        });
        console.log('✅ Memory stored:', JSON.stringify(storeResult, null, 2));

        // Test retrieving memories
        console.log('\n3. Retrieving memories...');
        const retrieveResult = await client.callTool('retrieve_memory', {
            query: 'MCP client hook integration',
            n_results: 5
        });
        console.log('✅ Retrieved memories:', JSON.stringify(retrieveResult, null, 2));

        // Disconnect
        await client.disconnect();
        console.log('\n✅ All tests completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }

        try {
            await client.disconnect();
        } catch (e) {
            // Ignore cleanup errors
        }

        process.exit(1);
    }
}

// Run the test
testMCPClient();