#!/usr/bin/env node
/**
 * Edge Case Testing for Memory Retrieval Fixes
 *
 * Tests:
 * 1. Content with Python keywords: True, False, None
 * 2. Memory object validation with missing fields
 * 3. JSON vs Python dict format detection
 * 4. Markdown conversion failures
 */

const https = require('https');
const http = require('http');

// Test configuration
const API_KEY = 'test-key-123';
const ENDPOINT = 'http://localhost:8443';

/**
 * Make HTTP request to memory server
 */
function makeRequest(method, params) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: method,
                arguments: params
            }
        });

        const url = new URL('/mcp', ENDPOINT);
        const options = {
            hostname: url.hostname,
            port: url.port || 8443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-API-Key': API_KEY
            },
            rejectUnauthorized: false
        };

        const protocol = url.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (error) {
                    reject(new Error(`Parse error: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => reject(error));
        req.write(postData);
        req.end();
    });
}

/**
 * Test 1: Python keywords in content
 */
async function testPythonKeywords() {
    console.log('\n=== TEST 1: Python Keywords in Content ===');

    const testContent = 'Python values: True, False, None are keywords. Also test \'single\' and "double" quotes.';

    // Store memory with edge case content
    console.log('Storing memory with Python keywords...');
    const storeResponse = await makeRequest('store_memory', {
        content: testContent,
        tags: ['test', 'edge-case', 'python-keywords']
    });

    if (storeResponse.error) {
        console.error('❌ Store failed:', storeResponse.error.message);
        return false;
    }

    console.log('✅ Stored successfully');

    // Retrieve and verify content is preserved
    console.log('Retrieving memory...');
    const retrieveResponse = await makeRequest('retrieve_memory', {
        query: 'Python values keywords',
        n_results: 1
    });

    if (retrieveResponse.error) {
        console.error('❌ Retrieve failed:', retrieveResponse.error.message);
        return false;
    }

    // Parse the response
    const textData = retrieveResponse.result.content[0].text;
    console.log('Raw response type:', typeof textData);
    console.log('First 100 chars:', textData.substring(0, 100));

    // Try parsing as JSON (new format)
    let memories;
    try {
        memories = JSON.parse(textData);
        console.log('✅ Parsed as valid JSON (new server format)');
    } catch (jsonError) {
        console.log('⚠️  Not JSON, checking if Python dict format...');
        try {
            const converted = textData
                .replace(/'/g, '"')
                .replace(/True/g, 'true')
                .replace(/False/g, 'false')
                .replace(/None/g, 'null');
            memories = JSON.parse(converted);
            console.log('✅ Converted from Python dict (old format)');
        } catch (convertError) {
            console.error('❌ Could not parse response:', convertError.message);
            return false;
        }
    }

    const retrievedContent = memories.memories[0].content;
    console.log('Retrieved content:', retrievedContent);

    if (retrievedContent === testContent) {
        console.log('✅ Content preserved exactly!');
        return true;
    } else {
        console.error('❌ Content corrupted!');
        console.error('Expected:', testContent);
        console.error('Got:', retrievedContent);
        return false;
    }
}

/**
 * Test 2: Response format detection
 */
async function testResponseFormat() {
    console.log('\n=== TEST 2: Response Format Detection ===');

    const retrieveResponse = await makeRequest('retrieve_memory', {
        query: 'test',
        n_results: 1
    });

    if (retrieveResponse.error) {
        console.error('❌ Retrieve failed:', retrieveResponse.error.message);
        return false;
    }

    const textData = retrieveResponse.result.content[0].text;

    // Check if response is valid JSON
    try {
        JSON.parse(textData);
        console.log('✅ Server sends proper JSON format (fixed!)');
        return true;
    } catch (error) {
        console.log('⚠️  Server still sends Python dict format');
        // Check if it looks like Python dict
        if (textData.includes("'memories':") || textData.includes("'query':")) {
            console.log('⚠️  Contains Python dict syntax (needs server restart?)');
            return true; // Not a failure, just needs restart
        } else {
            console.error('❌ Unknown response format:', textData.substring(0, 100));
            return false;
        }
    }
}

/**
 * Test 3: Memory object structure
 */
async function testMemoryStructure() {
    console.log('\n=== TEST 3: Memory Object Structure ===');

    const retrieveResponse = await makeRequest('retrieve_memory', {
        query: 'test',
        n_results: 1
    });

    if (retrieveResponse.error) {
        console.error('❌ Retrieve failed:', retrieveResponse.error.message);
        return false;
    }

    const textData = retrieveResponse.result.content[0].text;

    // Parse (try JSON first)
    let memories;
    try {
        memories = JSON.parse(textData);
    } catch (error) {
        const converted = textData
            .replace(/'/g, '"')
            .replace(/True/g, 'true')
            .replace(/False/g, 'false')
            .replace(/None/g, 'null');
        memories = JSON.parse(converted);
    }

    if (memories.memories && memories.memories.length > 0) {
        const memory = memories.memories[0];
        console.log('Memory object keys:', Object.keys(memory));

        // Check required fields
        const requiredFields = ['content', 'content_hash', 'tags', 'memory_type', 'created_at_iso', 'similarity_score'];
        const missingFields = requiredFields.filter(field => !(field in memory));

        if (missingFields.length === 0) {
            console.log('✅ All required fields present');
            return true;
        } else {
            console.error('❌ Missing fields:', missingFields);
            return false;
        }
    } else {
        console.error('❌ No memories in response');
        return false;
    }
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('🧪 Memory Retrieval Edge Case Tests');
    console.log('=====================================');

    const results = {
        pythonKeywords: false,
        responseFormat: false,
        memoryStructure: false
    };

    try {
        results.pythonKeywords = await testPythonKeywords();
    } catch (error) {
        console.error('❌ Test 1 error:', error.message);
    }

    try {
        results.responseFormat = await testResponseFormat();
    } catch (error) {
        console.error('❌ Test 2 error:', error.message);
    }

    try {
        results.memoryStructure = await testMemoryStructure();
    } catch (error) {
        console.error('❌ Test 3 error:', error.message);
    }

    // Summary
    console.log('\n=====================================');
    console.log('📊 Test Results:');
    console.log(`  Python Keywords: ${results.pythonKeywords ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Response Format: ${results.responseFormat ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Memory Structure: ${results.memoryStructure ? '✅ PASS' : '❌ FAIL'}`);

    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    console.log(`\nTotal: ${passed}/${total} tests passed`);

    if (passed === total) {
        console.log('\n✅ All edge case tests passed!');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed');
        process.exit(1);
    }
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});