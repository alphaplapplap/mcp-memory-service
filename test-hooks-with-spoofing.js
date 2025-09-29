#!/usr/bin/env node

const { MemoryClient } = require('./claude-hooks/utilities/memory-client');
const path = require('path');
const fs = require('fs');

async function testHooksWithSpoofing() {
    console.log('🎭 Testing Hooks with Spoofing Enabled...\n');

    // Load config with spoofing enabled
    const configPath = path.join(__dirname, 'claude-hooks', 'config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Ensure spoofing is enabled and forced
    config.memoryService.enableSpoofing = true;
    config.memoryService.spoofingMode = 'force';  // Force spoofing

    console.log('Configuration:');
    console.log('- Enable Spoofing:', config.memoryService.enableSpoofing);
    console.log('- Spoofing Mode:', config.memoryService.spoofingMode);
    console.log('- Protocol:', config.memoryService.protocol);
    console.log();

    // Create memory client
    const memoryClient = new MemoryClient(config.memoryService);

    try {
        console.log('1. Connecting memory client...');
        await memoryClient.connect();
        console.log('✅ Connected successfully\n');

        // Get connection info
        const connInfo = memoryClient.getConnectionInfo();
        console.log('Connection Info:', connInfo);
        console.log();

        // Store a memory
        console.log('2. Storing memory via hooks...');
        const storeResult = await memoryClient.mcpClient.callTool('store_memory', {
            content: 'Hooks working perfectly with spoofed MCP client',
            metadata: {
                tags: ['hooks', 'spoofing', 'test'],
                source: 'test-hooks-with-spoofing',
                timestamp: new Date().toISOString()
            }
        });
        console.log('✅ Memory stored:', JSON.stringify(storeResult, null, 2));
        console.log();

        // Query memories
        console.log('3. Querying memories via hooks...');
        const memories = await memoryClient.queryMemories('hooks spoofed', 10);
        console.log(`✅ Retrieved ${memories.length} memory/memories`);
        if (memories.length > 0) {
            console.log('First memory:', JSON.stringify(memories[0], null, 2));
        }
        console.log();

        // Check if we're using spoofed connection
        if (memoryClient.mcpClient && memoryClient.mcpClient.isSpoofed) {
            console.log('🎭 Using SPOOFED connection (no real server needed!)');
        } else {
            console.log('🔌 Using REAL server connection');
        }

        // Disconnect
        await memoryClient.disconnect();
        console.log('\n✅ Test completed successfully!');
        console.log('💡 Hooks can now work even when the real MCP server is unavailable!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Run the test
testHooksWithSpoofing();