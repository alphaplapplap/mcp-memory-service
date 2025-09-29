/**
 * Adaptive MCP Client
 * Automatically falls back to spoofed client when real connection fails
 */

const { EventEmitter } = require('events');
const RealMCPClient = require('./mcp-client').MCPClient;
const { SpoofedMCPClient } = require('./spoofed-mcp-client');

class AdaptiveMCPClient extends EventEmitter {
    constructor(serverCommand, options = {}) {
        super();
        this.serverCommand = serverCommand;
        this.options = options;
        this.useSpoof = options.useSpoof || false;
        this.autoFallback = options.autoFallback !== false;
        this.client = null;
        this.isSpoffed = false;
    }

    /**
     * Connect with automatic fallback to spoofing
     */
    async connect() {
        // If explicitly set to use spoof, use it directly
        if (this.useSpoof) {
            console.log('[Adaptive MCP] Using spoofed client (forced)');
            this.client = new SpoofedMCPClient(this.serverCommand, {
                ...this.options,
                enableLogging: false
            });
            this.isSpoofed = true;
            return await this.client.connect();
        }

        // Try real connection first
        try {
            console.log('[Adaptive MCP] Attempting real connection...');
            this.client = new RealMCPClient(this.serverCommand, {
                ...this.options,
                connectionTimeout: this.options.connectionTimeout || 3000
            });

            const result = await this.client.connect();
            console.log('[Adaptive MCP] Real connection successful');
            this.isSpoofed = false;
            return result;

        } catch (realError) {
            console.warn('[Adaptive MCP] Real connection failed:', realError.message);

            if (!this.autoFallback) {
                throw realError;
            }

            // Fallback to spoofed client
            console.log('[Adaptive MCP] Falling back to spoofed client...');
            this.client = new SpoofedMCPClient(this.serverCommand, {
                ...this.options,
                enableLogging: false
            });
            this.isSpoofed = true;

            try {
                const result = await this.client.connect();
                console.log('[Adaptive MCP] ✅ Spoofed connection established (fallback)');
                return result;
            } catch (spoofError) {
                console.error('[Adaptive MCP] Both real and spoofed connections failed');
                throw spoofError;
            }
        }
    }

    /**
     * Delegate all methods to the active client
     */
    async callTool(toolName, args) {
        if (!this.client) {
            throw new Error('Not connected');
        }
        return await this.client.callTool(toolName, args);
    }

    async getHealthStatus() {
        if (!this.client) {
            throw new Error('Not connected');
        }
        return await this.client.getHealthStatus();
    }

    async queryMemories(query, limit) {
        if (!this.client) {
            throw new Error('Not connected');
        }
        return await this.client.queryMemories(query, limit);
    }

    async queryMemoriesByTime(timeQuery, limit) {
        if (!this.client) {
            throw new Error('Not connected');
        }
        return await this.client.queryMemoriesByTime(timeQuery, limit);
    }

    async disconnect() {
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
            this.isSpoofed = false;
        }
    }

    async sendInitialize() {
        if (!this.client) {
            throw new Error('Not connected');
        }
        return await this.client.sendInitialize();
    }

    async sendMessage(message) {
        if (!this.client) {
            throw new Error('Not connected');
        }
        return await this.client.sendMessage(message);
    }

    /**
     * Get connection info
     */
    getConnectionInfo() {
        return {
            connected: !!this.client,
            isSpoofed: this.isSpoofed,
            type: this.isSpoofed ? 'spoofed' : 'real',
            message: this.isSpoofed ?
                'Using spoofed MCP (fallback mode - real server unavailable)' :
                'Connected to real MCP server'
        };
    }
}

module.exports = {
    MCPClient: AdaptiveMCPClient,
    AdaptiveMCPClient
};