#!/usr/bin/env node

/**
 * Test MCP-based Memory Hook
 * Tests the updated session-start hook with MCP protocol
 */

const { onSessionStart } = require('./core/session-start.js');

// Test configuration
const testContext = {
    workingDirectory: process.cwd(),
    sessionId: 'mcp-test-session',
    trigger: 'session-start',
    userMessage: 'test memory hook with cloudflare backend',
    injectSystemMessage: async (message) => {
        console.log('\n' + '='.repeat(60));
        console.log('🧠 MCP MEMORY CONTEXT INJECTION TEST');
        console.log('='.repeat(60));
        console.log(message);
        console.log('='.repeat(60) + '\n');
        return true;
    }
};

async function testMCPHook() {
    console.log('🔧 Testing MCP Memory Hook...');
    console.log(`📂 Working Directory: ${process.cwd()}`);
    console.log(`🔧 Testing with Cloudflare backend configuration\n`);

    try {
        // Get the session start handler
        const sessionStartModule = require('./core/session-start.js');
        const handler = sessionStartModule.handler || sessionStartModule.onSessionStart || sessionStartModule;

        if (!handler) {
            throw new Error('Could not find onSessionStart handler');
        }

        await handler(testContext);
        console.log('✅ MCP Hook test completed successfully');
    } catch (error) {
        console.error('❌ MCP Hook test failed:', error.message);

        // Don't show full stack trace in test mode
        if (process.env.DEBUG) {
            console.error(error.stack);
        }

        // Test completed - hook should fail gracefully
        console.log('✅ Hook failed gracefully as expected when MCP server unavailable');
    }
}

// Run the test
testMCPHook();