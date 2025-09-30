# Session-End Hook Analysis

## 🔍 Investigation: Does session-end hook work?

**Date:** 2025-09-30
**Status:** ⚠️ **PARTIALLY BROKEN** - Hook executes but fails to store memories

---

## ✅ What Works

1. **Hook Registration**
   - ✅ Properly registered in `~/.claude/hooks/core/session-end.js`
   - ✅ Module exports correct metadata:
     ```javascript
     module.exports = {
       name: 'memory-awareness-session-end',
       trigger: 'session-end',
       handler: onSessionEnd,
       config: { async: true, timeout: 15000 }
     }
     ```

2. **Configuration**
   - ✅ Enabled in `~/.claude/hooks/config.json` (line 93-97):
     ```json
     "sessionEnd": {
       "enabled": true,
       "timeout": 15000,
       "priority": "normal"
     }
     ```
   - ✅ Session consolidation enabled (line 30): `"enableSessionConsolidation": true`

3. **Execution Flow**
   - ✅ Hook executes when triggered
   - ✅ Project detection works: "mcp-memory-service (Documentation) 100%"
   - ✅ Conversation analysis works: "4 topics, 1 decisions, confidence: 80.0%"
   - ✅ Session consolidation formatting works

4. **Test Output**
   ```
   [Memory Hook] Session ending - consolidating outcomes...
   📂 Project Detector → Analyzing mcp-memory-service
   📊 Detection Result → mcp-memory-service (Documentation) • 100%
   [Memory Hook] Consolidating session for project: mcp-memory-service
   [Memory Hook] Session analysis: 4 topics, 1 decisions, confidence: 80.0%
   ```

---

## ❌ What's Broken

### **Critical Issue: Invalid URL Error**

**Error Message:**
```
[Memory Hook] Error in session end: Invalid URL
```

**Root Cause:**
The hook tries to access `config.memoryService.endpoint` and `config.memoryService.apiKey`, but the current config structure is different:

**Expected by hook (OLD structure):**
```javascript
// session-end.js:332-333
const result = await storeSessionMemory(
    config.memoryService.endpoint,  // ❌ UNDEFINED
    config.memoryService.apiKey,    // ❌ UNDEFINED
```

**Actual config structure (NEW structure):**
```json
{
  "memoryService": {
    "protocol": "http",
    "http": {
      "endpoint": "http://localhost:8443",  // ✅ Actual location
      "apiKey": "test-key-123"              // ✅ Actual location
    }
  }
}
```

**Impact:**
- Hook passes `undefined` to `new URL('/api/memories', undefined)` on line 212
- This causes "Invalid URL" error
- **No session memories are stored**

---

## 🔧 Technical Details

### Execution Trace

```javascript
onSessionEnd(context)
  ├─ ✅ Load config from config.json
  ├─ ✅ Check enableSessionConsolidation (true)
  ├─ ✅ Check session length (passes minimum)
  ├─ ✅ Detect project context (mcp-memory-service)
  ├─ ✅ Analyze conversation
  │   ├─ Extract topics: ["implementation", "architecture", "debugging", "testing"]
  │   ├─ Extract decisions: ["decided to use hooks for session management"]
  │   ├─ Calculate confidence: 0.8 (80%)
  │   └─ Format consolidation message
  │
  └─ ❌ storeSessionMemory(undefined, undefined, ...)
      └─ new URL('/api/memories', undefined)
          └─ TypeError: Invalid URL
```

### File: `session-end.js`

**Problem Lines:**

```javascript
// Line 332-337
const result = await storeSessionMemory(
    config.memoryService.endpoint,  // ❌ undefined (expects http.endpoint)
    config.memoryService.apiKey,    // ❌ undefined (expects http.apiKey)
    consolidation,
    projectContext,
    analysis
);
```

**Fallback Config (lines 24-29):**
```javascript
return {
    memoryService: {
        endpoint: 'https://narrowbox.local:8443',  // Old structure
        apiKey: 'test-key-123',
        defaultTags: ['claude-code', 'auto-generated'],
        enableSessionConsolidation: true
    }
}
```

---

## 🚨 Architectural Issues

### Issue #1: Direct HTTP Implementation
**Problem:** session-end.js implements its own HTTPS client instead of using `MemoryClient` utility.

**Location:** Lines 210-284 (`storeSessionMemory` function)

**Code:**
```javascript
async function storeSessionMemory(endpoint, apiKey, content, projectContext, analysis) {
    return new Promise((resolve, reject) => {
        const url = new URL('/api/memories', endpoint);

        const options = {
            hostname: url.hostname,
            port: url.port || 8443,
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'X-API-Key': apiKey  // ✅ Auth header is correct
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, ...);
    });
}
```

**Why This Is Bad:**
- ❌ Duplicates HTTP client logic (vs using MemoryClient)
- ❌ No protocol auto-detection (HTTP/MCP)
- ❌ No retry logic
- ❌ No health check fallback
- ❌ Different config structure from other hooks

### Issue #2: Inconsistent Config Access
**Problem:** Different hooks use different config structures.

**Comparison:**

| Hook | Config Access | Client Used |
|------|---------------|-------------|
| session-start.js | `http.endpoint` | MemoryClient |
| mid-conversation.js | `http.endpoint` | MemoryClient |
| topic-change.js | `http.endpoint` | Direct HTTPS (line 77-89) |
| **session-end.js** | **`endpoint`** ❌ | **Direct HTTPS** ❌ |
| memory-retrieval.js | `http.endpoint` | Direct HTTPS (line 54-65) |

### Issue #3: No MCP Protocol Support
**Problem:** session-end.js only supports HTTP, not MCP protocol.

**Impact:**
- Can't use MCP when it's the preferred protocol
- No fallback to MCP if HTTP fails
- Inconsistent with dual-protocol architecture

---

## 🔨 Solutions

### **Solution 1: Quick Fix - Update Config Access**

**Change lines 332-333:**

```javascript
// BEFORE (broken):
const result = await storeSessionMemory(
    config.memoryService.endpoint,
    config.memoryService.apiKey,

// AFTER (quick fix):
const result = await storeSessionMemory(
    config.memoryService.http.endpoint,
    config.memoryService.http.apiKey,
```

**Pros:**
- ✅ Minimal change
- ✅ Maintains existing storeSessionMemory function
- ✅ Works immediately

**Cons:**
- ❌ Still uses custom HTTP client
- ❌ No MCP support
- ❌ No protocol auto-detection
- ❌ Doesn't fix architectural inconsistency

---

### **Solution 2: Use MemoryClient (RECOMMENDED)**

**Refactor to use centralized MemoryClient utility:**

```javascript
const MemoryClient = require('../utilities/memory-client');

async function onSessionEnd(context) {
    try {
        // ... existing code ...

        // Load configuration
        const config = await loadConfig();

        // Initialize memory client
        const memoryClient = new MemoryClient(config.memoryService);

        // ... existing analysis code ...

        // Store using MemoryClient
        const result = await memoryClient.store({
            content: consolidation,
            tags: [
                'claude-code-session',
                'session-consolidation',
                projectContext.name,
                `language:${projectContext.language}`,
                ...analysis.topics.slice(0, 3),
                ...projectContext.frameworks.slice(0, 2),
                `confidence:${Math.round(analysis.confidence * 100)}`
            ].filter(Boolean),
            memory_type: 'session-summary',
            metadata: {
                session_analysis: {
                    topics: analysis.topics,
                    decisions_count: analysis.decisions.length,
                    insights_count: analysis.insights.length,
                    code_changes_count: analysis.codeChanges.length,
                    next_steps_count: analysis.nextSteps.length,
                    session_length: analysis.sessionLength,
                    confidence: analysis.confidence
                },
                project_context: {
                    name: projectContext.name,
                    language: projectContext.language,
                    frameworks: projectContext.frameworks
                },
                generated_by: 'claude-code-session-end-hook',
                generated_at: new Date().toISOString()
            }
        });

        // ... existing result handling ...
    } catch (error) {
        console.error('[Memory Hook] Error in session end:', error.message);
    }
}
```

**Changes Required:**
1. Add `const MemoryClient = require('../utilities/memory-client');` at top
2. Replace `storeSessionMemory()` call with `memoryClient.store()`
3. Remove `storeSessionMemory()` function (lines 210-284)

**Pros:**
- ✅ Uses centralized client (consistency)
- ✅ Automatic protocol detection (HTTP/MCP)
- ✅ Retry logic included
- ✅ Health check fallback
- ✅ Matches architecture of other hooks
- ✅ Easier to maintain (one HTTP client)

**Cons:**
- ⚠️ Larger refactor (but worth it)

---

## 📊 Impact Assessment

### Current State
```
Session ends
    ↓
session-end hook triggered
    ↓
Analysis completes (✅ 80% confidence)
    ↓
Tries to store: storeSessionMemory(undefined, undefined, ...)
    ↓
❌ Invalid URL error
    ↓
⚠️ SESSION SUMMARY LOST - NOT STORED
```

### After Quick Fix (Solution 1)
```
Session ends
    ↓
session-end hook triggered
    ↓
Analysis completes (✅ 80% confidence)
    ↓
Stores to HTTP endpoint
    ↓
✅ Session summary stored
    ↓
⚠️ But: no MCP support, custom client remains
```

### After MemoryClient Refactor (Solution 2)
```
Session ends
    ↓
session-end hook triggered
    ↓
Analysis completes (✅ 80% confidence)
    ↓
MemoryClient protocol detection
    ├─ Try MCP (if preferred)
    └─ Fallback to HTTP
    ↓
✅ Session summary stored
✅ Consistent architecture
✅ Full protocol support
```

---

## 🎯 Recommendation

**Implement Solution 2 (MemoryClient refactor)** because:

1. **Fixes the immediate bug** (Invalid URL)
2. **Architectural consistency** (all hooks use MemoryClient)
3. **Full protocol support** (HTTP + MCP)
4. **Better maintainability** (one client to update)
5. **Already tested** (MemoryClient is proven working in session-start.js)

**Priority:** HIGH - Session memories are not being stored currently

**Effort:** LOW - ~30 lines of code change, mostly copy-paste from session-start.js

---

## 🧪 Testing Plan

### After Fix:
1. ✅ Run `node ~/.claude/hooks/core/session-end.js` - Should complete without errors
2. ✅ Check server logs for store_memory call
3. ✅ Query memories for `tag:session-consolidation`
4. ✅ Verify metadata includes session_analysis
5. ✅ Test with real Claude Code session end

### Verification:
```bash
# 1. Test hook execution
node ~/.claude/hooks/core/session-end.js

# 2. Check if memory was stored
curl -X POST http://localhost:8443/mcp \
  -H "X-API-Key: test-key-123" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_by_tag",
      "arguments": {"tags": ["session-consolidation"], "n_results": 5}
    }
  }'

# 3. Check server logs
tail -20 /tmp/memory-server.log | grep "store_memory"
```

---

## 📝 Related Files

- **Hook file:** `~/.claude/hooks/core/session-end.js` (lines 332-333, 210-284)
- **Config file:** `~/.claude/hooks/config.json` (lines 2-38, 93-97)
- **Utility:** `~/.claude/hooks/utilities/memory-client.js` (reference implementation)
- **Reference:** `~/.claude/hooks/core/session-start.js` (good example of MemoryClient usage)

---

## ⚡ Quick Fix Command

```bash
# Apply quick fix (Solution 1)
sed -i '' 's/config\.memoryService\.endpoint/config.memoryService.http.endpoint/g' ~/.claude/hooks/core/session-end.js
sed -i '' 's/config\.memoryService\.apiKey/config.memoryService.http.apiKey/g' ~/.claude/hooks/core/session-end.js

# Test
node ~/.claude/hooks/core/session-end.js
```

---

**Conclusion:** Session-end hook is **configured correctly** and **executes successfully**, but **fails to store memories** due to incorrect config access pattern. Fix required: Update to use `http.endpoint` and `http.apiKey`, or better yet, refactor to use MemoryClient utility.