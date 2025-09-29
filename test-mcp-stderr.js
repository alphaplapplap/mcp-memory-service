#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('Testing MCP server outputs...\n');

const serverProcess = spawn('uv', ['run', 'memory', 'server'], {
    cwd: '/Users/linuxbabe/mcp-memory-service',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env }
});

let stdoutBuffer = '';
let stderrBuffer = '';
let allOutput = '';

serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    stdoutBuffer += output;
    allOutput += `[STDOUT] ${output}`;
    console.log('[STDOUT]', output.trim());
});

serverProcess.stderr.on('data', (data) => {
    const output = data.toString();
    stderrBuffer += output;
    allOutput += `[STDERR] ${output}`;
    console.log('[STDERR]', output.trim());
});

// After 3 seconds, send initialize and see what happens
setTimeout(() => {
    console.log('\n=== Sending initialize message ===\n');
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

    serverProcess.stdin.write(JSON.stringify(initMessage) + '\n');
}, 3000);

// Kill after 5 seconds
setTimeout(() => {
    console.log('\n=== Test complete, killing server ===\n');
    serverProcess.kill();

    console.log('All output containing "ready" or "init":');
    const lines = allOutput.split('\n');
    lines.forEach(line => {
        if (line.toLowerCase().includes('ready') ||
            line.toLowerCase().includes('init') ||
            line.toLowerCase().includes('start') ||
            line.toLowerCase().includes('server')) {
            console.log(line);
        }
    });

    process.exit(0);
}, 5000);

serverProcess.on('exit', (code) => {
    console.log(`\nServer exited with code ${code}`);
});