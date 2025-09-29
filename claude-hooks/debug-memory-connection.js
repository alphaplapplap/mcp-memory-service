#!/usr/bin/env node

/**
 * Debug script to test memory client connections
 */

const { MemoryClient } = require('./utilities/memory-client');
const { MCPClient } = require('./utilities/mcp-client');
const path = require('path');
const fs = require('fs');

console.log('\n=== Memory Connection Debug Tool ===\n');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

console.log('📋 Configuration loaded:');
console.log(`  Protocol: ${config.memoryService.protocol}`);
console.log(`  Preferred: ${config.memoryService.preferredProtocol}`);
console.log(`  Fallback enabled: ${config.memoryService.fallbackEnabled}`);
console.log('');

console.log('🔍 Environment:');
console.log(`  MCP_MEMORY_STORAGE_BACKEND: ${process.env.MCP_MEMORY_STORAGE_BACKEND || 'not set'}`);
console.log(`  Working Directory: ${config.memoryService.mcp.serverWorkingDir}`);
console.log('');

// Test MCP server command
console.log('🧪 Testing MCP Server Command:');
console.log(`  Command: ${config.memoryService.mcp.serverCommand.join(' ')}`);
console.log('');

async function testMCPConnection() {
    console.log('1️⃣ Testing MCP Protocol Connection...\n');

    const mcpClient = new MCPClient(
        config.memoryService.mcp.serverCommand,
        {
            workingDir: config.memoryService.mcp.serverWorkingDir,
            connectionTimeout: 5000,
            toolCallTimeout: 10000
        }
    );

    try {
        console.log('   ⏳ Starting MCP server process...');
        await mcpClient.connect();
        console.log('   ✅ MCP connection successful!');

        // Test health check
        console.log('   🏥 Testing MCP health check...');
        const health = await mcpClient.getHealthStatus();
        console.log('   ✅ Health check response received');

        await mcpClient.disconnect();
        return true;
    } catch (error) {
        console.log(`   ❌ MCP connection failed: ${error.message}`);
        console.log(`      Error details: ${JSON.stringify(error, null, 2)}`);
        return false;
    }
}

async function testHTTPConnection() {
    console.log('\n2️⃣ Testing HTTP Protocol Connection...\n');

    const https = require('https');
    const url = new URL('/api/health', config.memoryService.http.endpoint);

    return new Promise((resolve) => {
        console.log(`   🌐 Connecting to ${config.memoryService.http.endpoint}...`);

        const requestOptions = {
            hostname: url.hostname,
            port: url.port || 8443,
            path: url.pathname,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${config.memoryService.http.apiKey}`,
                'Accept': 'application/json'
            },
            timeout: 3000,
            rejectUnauthorized: false
        };

        const req = https.request(requestOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('   ✅ HTTP connection successful!');
                    console.log(`   📊 Response: ${data.substring(0, 100)}...`);
                    resolve(true);
                } else {
                    console.log(`   ❌ HTTP connection failed: Status ${res.statusCode}`);
                    console.log(`      Response: ${data}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.log(`   ❌ HTTP connection failed: ${error.message}`);
            resolve(false);
        });

        req.on('timeout', () => {
            req.destroy();
            console.log('   ❌ HTTP connection timeout');
            resolve(false);
        });

        req.end();
    });
}

async function testUnifiedClient() {
    console.log('\n3️⃣ Testing Unified Memory Client...\n');

    const memoryClient = new MemoryClient(config.memoryService);

    try {
        console.log('   🔗 Attempting connection with auto mode...');
        const connection = await memoryClient.connect();
        console.log(`   ✅ Connection successful using ${connection.protocol} protocol!`);

        const connectionInfo = memoryClient.getConnectionInfo();
        console.log(`   📊 Connection Info:`);
        console.log(`      Active Protocol: ${connectionInfo.activeProtocol}`);
        console.log(`      HTTP Available: ${connectionInfo.httpAvailable}`);
        console.log(`      MCP Available: ${connectionInfo.mcpAvailable}`);

        // Test memory query
        console.log('\n   🧠 Testing memory query...');
        try {
            const memories = await memoryClient.queryMemories('test', 5);
            console.log(`   ✅ Memory query successful! Found ${memories.length} memories`);
        } catch (queryError) {
            console.log(`   ⚠️ Memory query failed: ${queryError.message}`);
        }

        await memoryClient.disconnect();
        return true;
    } catch (error) {
        console.log(`   ❌ Unified client connection failed: ${error.message}`);
        return false;
    }
}

async function suggestFixes(mcpOk, httpOk) {
    console.log('\n📝 Suggested Fixes:\n');

    if (!mcpOk && !httpOk) {
        console.log('❗ Both protocols failed. Suggestions:');
        console.log('');
        console.log('   1. Check if MCP server is installed:');
        console.log('      uv run memory --help');
        console.log('');
        console.log('   2. Verify storage backend configuration:');
        console.log('      - Current backend in .env: chroma');
        console.log('      - Config is trying to use: cloudflare');
        console.log('      - Valid options: sqlite_vec, chromadb, cloudflare');
        console.log('');
        console.log('   3. Fix the server command in config.json:');
        console.log('      Change: ["uv", "run", "memory", "server", "-s", "cloudflare"]');
        console.log('      To:     ["uv", "run", "memory", "server", "-s", "chromadb"]');
        console.log('      Or:     ["uv", "run", "memory", "server"] (to use .env default)');
        console.log('');
        console.log('   4. For HTTP server, start it manually:');
        console.log('      uv run memory server --http');
    } else if (!mcpOk) {
        console.log('❗ MCP protocol failed but HTTP works. Using HTTP fallback.');
    } else if (!httpOk) {
        console.log('✅ MCP protocol works. HTTP server not needed.');
    }
}

// Run tests
async function runDebug() {
    const mcpOk = await testMCPConnection();
    const httpOk = await testHTTPConnection();
    const unifiedOk = await testUnifiedClient();

    await suggestFixes(mcpOk, httpOk);

    console.log('\n=== Debug Complete ===\n');
    process.exit(unifiedOk ? 0 : 1);
}

runDebug().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});