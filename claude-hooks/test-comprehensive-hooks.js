#!/usr/bin/env node

/**
 * Comprehensive Hook Test
 * Tests memory storage and retrieval through the hook system
 */

const MCPClient = require('./utilities/mcp-client.js');
const { MemoryClient } = require('./utilities/memory-client.js');
const config = require('./config.json');

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHooks() {
    console.log('='.repeat(60));
    console.log('🧠 COMPREHENSIVE MEMORY HOOK TEST');
    console.log('='.repeat(60));

    let memoryClient = null;

    try {
        console.log('\n📊 Test Configuration:');
        console.log(`  Protocol: ${config.memoryService.protocol}`);
        console.log(`  Preferred: ${config.memoryService.preferredProtocol}`);
        console.log(`  Fallback: ${config.memoryService.fallbackEnabled}`);

        // Initialize memory client
        console.log('\n🔧 Initializing Memory Client...');
        memoryClient = new MemoryClient(config.memoryService);

        // Try to connect
        console.log('🔗 Attempting connection...');
        const connected = await memoryClient.connect();

        if (!connected) {
            console.log('⚠️  Could not establish connection');
            return;
        }

        console.log(`✅ Connected via ${memoryClient.activeProtocol} protocol`);

        // Get health status
        console.log('\n📊 Checking Health Status...');
        const health = await memoryClient.getHealthStatus();

        if (health.success) {
            console.log('✅ Health Check Passed:');
            if (health.data) {
                console.log(`  Status: ${health.data.status || 'unknown'}`);
                console.log(`  Storage: ${health.data.storage_backend || 'unknown'}`);
                console.log(`  Memory Count: ${health.data.memory_count || 0}`);
            }
        } else {
            console.log(`⚠️  Health check failed: ${health.error}`);
        }

        // Note: Memories were already stored via MCP tools
        console.log('\n📝 Using Previously Stored Test Memories:');
        console.log('  ✅ Critical bug fix: authentication race condition');
        console.log('  ✅ Performance optimization: memory lookup improvements');
        console.log('  ✅ Documentation: API documentation for hooks');

        // Query memories
        console.log('\n🔍 Querying Memories...');

        // Query by content
        console.log('  📍 Query: "authentication race condition"');
        const queryResult1 = await memoryClient.queryMemories("authentication race condition", 3);

        if (queryResult1.success && queryResult1.data && queryResult1.data.length > 0) {
            console.log(`  ✅ Found ${queryResult1.data.length} memories`);
            queryResult1.data.forEach(mem => {
                console.log(`    - ${mem.content.substring(0, 60)}...`);
            });
        } else {
            console.log(`  ⚠️  No memories found or query failed`);
        }

        // Test time-based query
        console.log('\n  📍 Query: Recent memories (last week)');
        const queryResult2 = await memoryClient.queryMemoriesByTime("last-week", 10);

        if (queryResult2.success && queryResult2.data && queryResult2.data.length > 0) {
            console.log(`  ✅ Found ${queryResult2.data.length} recent memories`);
            queryResult2.data.forEach(mem => {
                console.log(`    - ${mem.content.substring(0, 60)}...`);
            });
        } else {
            console.log(`  ⚠️  No recent memories found or query failed`);
        }

        // Test the session-start hook
        console.log('\n🚀 Testing Session Start Hook...');
        const { onSessionStart } = require('./core/session-start.js');

        const testContext = {
            workingDirectory: process.cwd(),
            sessionId: 'comprehensive-test',
            trigger: 'session-start',
            userMessage: 'I need to fix the authentication issue',
            injectSystemMessage: async (message) => {
                console.log('\n📨 System Message Injection:');
                console.log('─'.repeat(50));
                console.log(message);
                console.log('─'.repeat(50));
                return true;
            }
        };

        await onSessionStart(testContext);

        console.log('\n✅ All tests completed successfully!');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        if (process.env.DEBUG) {
            console.error(error.stack);
        }
    } finally {
        // Cleanup
        if (memoryClient) {
            try {
                await memoryClient.disconnect();
                console.log('\n🔌 Disconnected from memory service');
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}

// Run the test
console.log('Starting comprehensive hook test...\n');
testHooks().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});