/**
 * Mock MCP Server
 * Spoofs MCP server responses for testing without real server limitations
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class MockMCPServer extends EventEmitter {
    constructor() {
        super();
        this.memories = new Map();
        this.connected = false;
        this.messageId = 0;
    }

    /**
     * Simulate server initialization
     */
    async initialize() {
        // Simulate server startup delay
        await this.delay(100);

        this.connected = true;

        // Emit fake server ready messages
        this.emit('data', 'Server capabilities registered successfully!\n');
        this.emit('data', 'MCP Memory Service initialization completed\n');

        return {
            jsonrpc: '2.0',
            id: 1,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: { listChanged: false },
                    resources: { listChanged: false },
                    prompts: { listChanged: false }
                },
                serverInfo: {
                    name: 'mock-memory-server',
                    version: '1.0.0'
                }
            }
        };
    }

    /**
     * Handle tool calls with spoofed responses
     */
    async callTool(toolName, args = {}) {
        await this.delay(50); // Simulate processing time

        switch (toolName) {
            case 'store_memory':
                return this.mockStoreMemory(args);

            case 'retrieve_memory':
            case 'recall_memory':
                return this.mockRetrieveMemory(args);

            case 'search_by_tag':
                return this.mockSearchByTag(args);

            case 'check_database_health':
                return this.mockHealthCheck();

            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    /**
     * Mock memory storage
     */
    mockStoreMemory(args) {
        const id = crypto.randomBytes(16).toString('hex');
        const memory = {
            id,
            content: args.content,
            metadata: args.metadata || {},
            tags: args.metadata?.tags || [],
            timestamp: new Date().toISOString(),
            embedding: this.generateFakeEmbedding()
        };

        this.memories.set(id, memory);

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    memory_id: id,
                    message: 'Memory stored successfully',
                    storage_backend: 'mock'
                })
            }]
        };
    }

    /**
     * Mock memory retrieval
     */
    mockRetrieveMemory(args) {
        const query = args.query || '';
        const limit = args.n_results || 10;

        // Return fake memories that match the query
        const results = [];
        let count = 0;

        for (const [id, memory] of this.memories) {
            if (count >= limit) break;

            // Simple mock matching - check if query appears in content
            if (!query || memory.content.toLowerCase().includes(query.toLowerCase())) {
                results.push({
                    id: memory.id,
                    content: memory.content,
                    metadata: memory.metadata,
                    similarity: 0.85 + Math.random() * 0.15, // Fake similarity score
                    timestamp: memory.timestamp
                });
                count++;
            }
        }

        // If no real memories, return some fake ones
        if (results.length === 0 && query) {
            results.push({
                id: 'mock-' + crypto.randomBytes(8).toString('hex'),
                content: `Mock memory related to: ${query}`,
                metadata: { source: 'mock', type: 'generated' },
                similarity: 0.75,
                timestamp: new Date().toISOString()
            });
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    results,
                    total: results.length,
                    backend: 'mock'
                })
            }]
        };
    }

    /**
     * Mock tag search
     */
    mockSearchByTag(args) {
        const tags = args.tags || [];
        const results = [];

        for (const [id, memory] of this.memories) {
            const memoryTags = memory.tags || [];
            if (tags.some(tag => memoryTags.includes(tag))) {
                results.push({
                    id: memory.id,
                    content: memory.content,
                    metadata: memory.metadata,
                    tags: memoryTags,
                    timestamp: memory.timestamp
                });
            }
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    results,
                    total: results.length,
                    backend: 'mock'
                })
            }]
        };
    }

    /**
     * Mock health check
     */
    mockHealthCheck() {
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    status: 'healthy',
                    backend: 'mock',
                    total_memories: this.memories.size,
                    version: '1.0.0',
                    message: 'Mock server running perfectly'
                })
            }]
        };
    }

    /**
     * Generate fake embedding vector
     */
    generateFakeEmbedding() {
        return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Disconnect mock server
     */
    async disconnect() {
        this.connected = false;
        this.memories.clear();
    }
}

module.exports = { MockMCPServer };