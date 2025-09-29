#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Test direct MCP communication
async function testMCP() {
    console.log('Testing direct MCP connection...\n');

    return new Promise((resolve, reject) => {
        // Start MCP server
        const serverProcess = spawn('uv', ['run', 'memory', 'server'], {
            cwd: '/Users/linuxbabe/mcp-memory-service',
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, LOG_LEVEL: 'DEBUG' }
        });

        let buffer = '';
        let connected = false;

        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('STDOUT:', output);
            buffer += output;

            // Look for successful initialization
            if (output.includes('Server started and ready') || output.includes('initialization completed')) {
                console.log('✓ Server initialized');

                // Send initialize message
                const initMessage = {
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {}
                        },
                        clientInfo: {
                            name: 'test-client',
                            version: '1.0.0'
                        }
                    }
                };

                console.log('\nSending initialize message:', JSON.stringify(initMessage));
                serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');
                connected = true;
            }

            // Process JSON responses
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const message = JSON.parse(line);
                        console.log('Received message:', JSON.stringify(message, null, 2));

                        if (message.result && message.id === 1) {
                            console.log('\n✅ Successfully connected to MCP server!');
                            serverProcess.kill();
                            resolve();
                        }
                    } catch (e) {
                        // Not JSON, just log output
                    }
                }
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.log('STDERR:', data.toString());
        });

        serverProcess.on('exit', (code) => {
            console.log(`\nServer exited with code ${code}`);
            if (code !== 0 && !connected) {
                reject(new Error(`Server failed to start (exit code ${code})`));
            } else {
                resolve();
            }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (!connected) {
                console.log('\n❌ Connection timeout');
                serverProcess.kill();
                reject(new Error('Connection timeout'));
            }
        }, 10000);
    });
}

// Run test
testMCP()
    .then(() => console.log('\nTest completed'))
    .catch(error => console.error('\nTest failed:', error.message));