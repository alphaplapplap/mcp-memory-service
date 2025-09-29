#!/usr/bin/env node

const { MCPClient } = require('./claude-hooks/utilities/mcp-client.js');

async function testMCPClient() {
    console.log('Testing MCP client with debug logging...\n');

    const client = new MCPClient(['uv', 'run', 'memory', 'server'], {
        workingDir: '/Users/linuxbabe/mcp-memory-service',
        connectionTimeout: 15000, // Longer timeout
        toolCallTimeout: 10000
    });

    // Add debug logging to see what's happening
    const originalConnect = client.connect.bind(client);
    client.connect = async function() {
        console.log('Starting connection...');

        // Override buffer setter to see what's being received
        let _buffer = '';
        Object.defineProperty(this, 'buffer', {
            get() { return _buffer; },
            set(val) {
                _buffer = val;
                console.log('[BUFFER UPDATE]:', val.substring(0, 200));
            }
        });

        return originalConnect();
    };

    try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✅ Successfully connected!');

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