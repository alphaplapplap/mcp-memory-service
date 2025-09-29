/**
 * Spoofed MCP Client
 * Uses mock server to bypass real MCP connection limitations
 */

const { EventEmitter } = require('events');
const { MockMCPServer } = require('./mock-mcp-server');

class SpoofedMCPClient extends EventEmitter {
    constructor(serverCommand, options = {}) {
        super();
        this.serverCommand = serverCommand;
        this.options = options;
        this.mockServer = new MockMCPServer();
        this.connected = false;
        this.messageId = 0;
        this.enableLogging = options.enableLogging || false;
    }

    log(message) {
        if (this.enableLogging) {
            console.log(`[Spoofed MCP] ${message}`);
        }
    }

    /**
     * Fake connection that always succeeds
     */
    async connect() {
        this.log('Spoofing connection...');

        // Simulate connection delay
        await this.delay(200);

        // Initialize mock server
        const initResult = await this.mockServer.initialize();

        // Mark as connected
        this.connected = true;
        this.log('Spoofed connection established');

        return initResult;
    }

    /**
     * Send fake initialize message
     */
    async sendInitialize() {
        return {
            jsonrpc: '2.0',
            id: ++this.messageId,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: { listChanged: false }
                },
                serverInfo: {
                    name: 'spoofed-memory',
                    version: '1.0.0'
                }
            }
        };
    }

    /**
     * Call tool using mock server
     */
    async callTool(toolName, args = {}) {
        if (!this.connected) {
            throw new Error('Not connected to spoofed server');
        }

        this.log(`Calling spoofed tool: ${toolName}`);

        try {
            const result = await this.mockServer.callTool(toolName, args);
            return result;
        } catch (error) {
            this.log(`Spoofed tool error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get spoofed health status
     */
    async getHealthStatus() {
        return {
            success: true,
            data: {
                status: 'healthy',
                backend: 'spoofed',
                message: 'Spoofed server running perfectly',
                version: '1.0.0'
            }
        };
    }

    /**
     * Query memories using mock server
     */
    async queryMemories(query, limit = 10) {
        const result = await this.callTool('retrieve_memory', {
            query,
            n_results: limit
        });

        return this.parseToolResponse(result.content);
    }

    /**
     * Query memories by time (spoofed)
     */
    async queryMemoriesByTime(timeQuery, limit = 10) {
        // For spoofing, just treat time queries as regular queries
        return this.queryMemories(timeQuery, limit);
    }

    /**
     * Parse tool response
     */
    parseToolResponse(content) {
        if (!content) return [];

        if (Array.isArray(content)) {
            const textContent = content.find(c => c.type === 'text')?.text || '';
            try {
                const parsed = JSON.parse(textContent);
                return parsed.results || parsed.memories || [];
            } catch {
                return [];
            }
        }

        if (typeof content === 'string') {
            try {
                const parsed = JSON.parse(content);
                return parsed.results || parsed.memories || [];
            } catch {
                return [];
            }
        }

        return [];
    }

    /**
     * Fake disconnect
     */
    async disconnect() {
        this.connected = false;
        await this.mockServer.disconnect();
        this.log('Spoofed connection closed');
    }

    /**
     * Utility delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Send message (for compatibility)
     */
    async sendMessage(message) {
        // Just return a fake successful response
        return {
            jsonrpc: '2.0',
            id: message.id,
            result: {}
        };
    }
}

// Export as MCPClient for drop-in replacement
module.exports = {
    MCPClient: SpoofedMCPClient,
    SpoofedMCPClient
};