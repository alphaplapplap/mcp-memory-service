# Memory Hook Fix Documentation

## Issue Summary
The Claude Code memory hook was failing to connect to the MCP memory service with "Failed to connect using any available protocol" and "memoryClient is not defined" errors.

## Root Causes Identified and Fixed

### 1. Variable Scope Error in session-start.js
**Problem**: `memoryClient` variable was declared inside the main try block but accessed in the finally block, causing "memoryClient is not defined" error.

**Fix**: Moved `memoryClient` declaration outside the try block:
```javascript
async function onSessionStart(context) {
    // Declare memoryClient outside try block for finally block access
    let memoryClient = null;

    try {
        // ... rest of function
```

**Location**: `/claude-hooks/core/session-start.js` lines 355-356

### 2. Missing activeProtocol Setting in HTTP Connection
**Problem**: `MemoryClient.connectHTTP()` method was not setting `this.activeProtocol = 'http'`, causing `getHealthStatus()` to fail with "No active connection available".

**Fix**: Added activeProtocol setting in connectHTTP method:
```javascript
async connectHTTP() {
    // Test HTTP connection with a simple health check
    const healthResult = await this.queryHealthHTTP();
    if (!healthResult.success) {
        throw new Error(`HTTP connection failed: ${healthResult.error}`);
    }
    this.httpAvailable = true;
    this.activeProtocol = 'http';  // <-- ADDED THIS LINE
    return true;
}
```

**Location**: `/claude-hooks/utilities/memory-client.js` line 133

### 3. Configuration Changes for HTTP Transport Testing
For testing purposes, several configuration changes were made to force HTTP protocol:

**config.json changes**:
- Set `protocol: "http"` instead of `"auto"`
- Set `preferredProtocol: "http"` instead of `"mcp"`
- Set `fallbackEnabled: false`
- Set `mcp.serverCommand: null` to prevent MCP spawning
- Changed endpoint from `https://localhost:8443` to `http://localhost:8000`

**memory-client.js changes**:
- Added logic to detect null serverCommand and force HTTP mode
- Changed `require('https')` to `require('http')`
- Updated port references from 8443 to 8000

## Test Results

### Before Fix
```
❌ MCP Hook test failed: memoryClient is not defined
[Memory Hook] Memory query error: No active connection available
```

### After Fix
```
✅ MCP Hook test completed successfully
[36m🔗 Connection[0m → Using HTTP protocol
[36m💾 Storage[0m → 🪶 sqlite-vec (Connected)
[33m📭 Memory Search[0m → No relevant memories found
```

## Files Modified
1. `/claude-hooks/core/session-start.js` - Fixed variable scope
2. `/claude-hooks/utilities/memory-client.js` - Fixed activeProtocol setting
3. `/claude-hooks/config.json` - Temporary config for HTTP testing (to be reverted)

## Permanent Fixes vs Temporary Changes

**Permanent fixes (keep these)**:
- Variable scope fix in session-start.js
- activeProtocol setting fix in memory-client.js

**Temporary changes (revert these)**:
- config.json HTTP-only configuration
- memory-client.js HTTP-forced logic

## Next Steps
Revert the configuration to original MCP mode while keeping the two core fixes for proper functionality.

## Additional MCP Client Fixes (Session 2)

### 4. Server Command Validation Error
**Problem**: MCPClient was calling `this.serverCommand.slice()` without validating that serverCommand was an array, causing TypeError.

**Fix**: Added proper serverCommand validation in constructor:
```javascript
// Ensure serverCommand is an array
if (!serverCommand) {
    throw new Error('MCPClient: serverCommand is required');
}

if (typeof serverCommand === 'string') {
    // Split string command into array
    this.serverCommand = serverCommand.split(' ');
} else if (Array.isArray(serverCommand)) {
    this.serverCommand = serverCommand;
} else {
    throw new Error('MCPClient: serverCommand must be a string or array');
}
```

**Location**: `/claude-hooks/utilities/mcp-client.js` lines 14-26

### 5. Server Ready Detection Not Matching Actual Output
**Problem**: MCP client was checking for non-existent server ready messages, causing connection timeouts.

**Fix**: Updated server ready detection to match actual server output:
```javascript
if (this.buffer.includes('Server capabilities registered') ||
    this.buffer.includes('MCP Memory Service initialization completed') ||
    this.buffer.includes('initialization completed') ||
    this.buffer.includes('[OK] Eager storage initialization successful')) {
    // Server is ready
}
```

**Location**: `/claude-hooks/utilities/mcp-client.js` lines 128-131

### 6. Buffer Cleared Before Ready Check
**Problem**: processMessages() was clearing the buffer before checkServerReady() could detect the ready message.

**Fix**: Added early ready check before processing messages:
```javascript
this.serverProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    this.buffer += chunk;

    // Check for server ready before processing messages
    if (!serverReady) {
        checkServerReady();
    }

    this.processMessages();
});
```

**Location**: `/claude-hooks/utilities/mcp-client.js` lines 87-96

### 7. Improved Error Handling for Server stderr
**Problem**: Server stderr output was causing uncaught error events crashing the client.

**Fix**: Changed error handling to log warnings without crashing:
```javascript
this.serverProcess.stderr.on('data', (data) => {
    const error = data.toString();
    // Log warnings/errors but don't emit as errors unless truly critical
    if (error.includes('WARNING')) {
        // Ignore warnings
    } else if (error.includes('ERROR') && !error.includes('SSLError')) {
        console.warn('[MCP Client] Server error:', error.substring(0, 200));
    }
});
```

**Location**: `/claude-hooks/utilities/mcp-client.js` lines 99-107

## Updated Files List
1. `/claude-hooks/core/session-start.js` - Fixed variable scope
2. `/claude-hooks/utilities/memory-client.js` - Fixed activeProtocol setting
3. `/claude-hooks/utilities/mcp-client.js` - Fixed serverCommand validation, server ready detection, buffer handling, and error handling
4. `/claude-hooks/config.json` - Configuration for MCP connection

## Testing Status
The MCP client now successfully:
- Validates serverCommand input properly
- Detects server ready state correctly
- Connects to the memory service
- Handles server errors gracefully

Remaining issue: TaskGroup exceptions in server when handling tool calls (server-side issue, not client issue)