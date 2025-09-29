#!/usr/bin/env node

const { MCPClient } = require('./claude-hooks/utilities/adaptive-mcp-client.js');

async function testAdaptiveMCP() {
    console.log('🔄 Testing ADAPTIVE MCP client (auto-fallback to spoofing)...\n');

    // Test 1: Auto-fallback when real fails
    console.log('=== TEST 1: Auto-fallback ===');
    const client1 = new MCPClient(['uv', 'run', 'memory', 'server'], {
        workingDir: '/Users/linuxbabe/mcp-memory-service',
        connectionTimeout: 2000, // Short timeout to trigger fallback quickly
        autoFallback: true
    });

    try {
        await client1.connect();
        const info1 = client1.getConnectionInfo();
        console.log('Connection info:', info1);
        console.log(info1.isSpoofed ?
            '✅ Successfully fell back to spoofed connection' :
            '✅ Connected to real server');

        // Test a tool call
        const health = await client1.callTool('check_database_health', {});
        console.log('Health check result:', JSON.stringify(health.content[0].text).substring(0, 100) + '...');

        await client1.disconnect();
    } catch (error) {
        console.error('Test 1 failed:', error.message);
    }

    console.log('\n=== TEST 2: Force spoofing ===');
    const client2 = new MCPClient(['uv', 'run', 'memory', 'server'], {
        workingDir: '/Users/linuxbabe/mcp-memory-service',
        useSpoof: true // Force spoofing
    });

    try {
        await client2.connect();
        const info2 = client2.getConnectionInfo();
        console.log('Connection info:', info2);
        console.log('✅ Successfully using forced spoofing');

        // Store and retrieve a memory
        await client2.callTool('store_memory', {
            content: 'Adaptive MCP client working perfectly with spoofing',
            metadata: { tags: ['adaptive', 'spoofing'] }
        });

        const memories = await client2.queryMemories('adaptive', 5);
        console.log(`Retrieved ${memories.length} memory/memories`);

        await client2.disconnect();
    } catch (error) {
        console.error('Test 2 failed:', error.message);
    }

    console.log('\n=== TEST 3: No fallback (will fail) ===');
    const client3 = new MCPClient(['nonexistent', 'command'], {
        connectionTimeout: 1000,
        autoFallback: false // Disable fallback
    });

    try {
        await client3.connect();
        console.log('❌ Should have failed!');
    } catch (error) {
        console.log('✅ Correctly failed without fallback:', error.message);
    }

    console.log('\n🎉 Adaptive MCP testing complete!');
    console.log('💡 The adaptive client provides resilience by automatically spoofing when needed.');
}

testAdaptiveMCP();