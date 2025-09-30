# MCP Memory Service - Data Flow Map

## 🗺️ Complete System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLAUDE CODE SESSION                                 │
│                     (User conversation with Claude)                          │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             │ Lifecycle Events
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HOOK TRIGGER SYSTEM                                 │
│                                                                              │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ session-start  │  │  topic-change   │  │  mid-convo   │  │session-end │ │
│  │     hook       │  │      hook       │  │     hook     │  │    hook    │ │
│  └────────┬───────┘  └────────┬────────┘  └──────┬───────┘  └─────┬──────┘ │
│           │                   │                   │                │        │
└───────────┼───────────────────┼───────────────────┼────────────────┼────────┘
            │                   │                   │                │
            │ ┌─────────────────┼───────────────────┼────────────────┘
            │ │                 │                   │
            ▼ ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NATURAL TRIGGERS v7.1.0                             │
│                    (Intelligent Pattern Detection)                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Pattern Detector (mid-conversation-hook.js)                        │   │
│  │  ─────────────────────────────────────────────────────────────      │   │
│  │  Input: User message text + conversation history                    │   │
│  │                                                                      │   │
│  │  1. Explicit Pattern Matching (50-70% confidence)                   │   │
│  │     • "what did we decide" → decision recall                        │   │
│  │     • "how did we implement" → implementation recall                │   │
│  │     • "what was the approach" → architecture recall                 │   │
│  │                                                                      │   │
│  │  2. Conversation Analysis (tiered processing)                       │   │
│  │     ┌────────────────────────────────────────────────────┐          │   │
│  │     │ Tier 0: Instant (<50ms) - Pattern matching only   │          │   │
│  │     │ Tier 1: Fast (<150ms) - + Topic extraction        │          │   │
│  │     │ Tier 2: Intensive (<500ms) - + Semantic analysis  │          │   │
│  │     └────────────────────────────────────────────────────┘          │   │
│  │                                                                      │   │
│  │  3. Context Boost Calculation                                       │   │
│  │     • Question pattern: +10%                                        │   │
│  │     • Past work reference: +15%                                     │   │
│  │     • Semantic shift: +20%                                          │   │
│  │                                                                      │   │
│  │  4. Trigger Decision (threshold: 60%)                               │   │
│  │     confidence >= 60% → TRIGGER MEMORY RETRIEVAL                    │   │
│  │     confidence < 60% → SKIP                                         │   │
│  │                                                                      │   │
│  │  Output: { shouldTrigger, confidence, reasoning, topics }           │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│                                     │ if shouldTrigger                      │
│                                     ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  executeMemoryTrigger()                                             │   │
│  │  ───────────────────────                                            │   │
│  │  • Cooldown check (30s between triggers)                            │   │
│  │  • Build query from detected topics                                 │   │
│  │  • Call memory retrieval                                            │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          UTILITY LAYER                                       │
│                                                                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ Project         │  │ Memory Client    │  │ Context Formatter          │ │
│  │ Detector        │  │ (HTTP/MCP)       │  │                            │ │
│  │                 │  │                  │  │ • formatMemoriesForContext │ │
│  │ • Detect lang   │  │ • Protocol auto- │  │ • formatSessionConsolid..  │ │
│  │ • Find packages │  │   detection      │  │ • Group by category        │ │
│  │ • Git analysis  │  │ • Retry logic    │  │ • Add timestamps           │ │
│  │ • Frameworks    │  │ • Health checks  │  │                            │ │
│  └────────┬────────┘  └─────────┬────────┘  └──────────┬─────────────────┘ │
│           │                     │                       │                   │
└───────────┼─────────────────────┼───────────────────────┼───────────────────┘
            │                     │                       │
            │ Project Context     │ Memory Query          │ Formatted Output
            │                     │                       │
            ▼                     ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MEMORY CLIENT                                       │
│                    (utilities/memory-client.js)                              │
│                                                                              │
│  Protocol Auto-Detection:                                                   │
│  ──────────────────────                                                     │
│  1. Try MCP (preferred) → Direct server process communication               │
│  2. Fallback to HTTP → Web API at https://localhost:8443                    │
│  3. Environment check → Load from config.json                               │
│                                                                              │
│  Authentication:                                                             │
│  ──────────────                                                             │
│  • X-API-Key header (test-key-123)                                          │
│  • TLS with self-signed cert support                                        │
│                                                                              │
│  Operations:                                                                 │
│  ──────────                                                                 │
│  • query() → retrieve_memory tool call                                      │
│  • store() → store_memory tool call                                         │
│  • health() → check_database_health tool call                               │
│                                                                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             │ HTTPS + JSON-RPC 2.0
                             │
┌────────────────────────────▼────────────────────────────────────────────────┐
│                          MCP SERVER                                          │
│                    (src/mcp_memory_service/mcp_server.py)                    │
│                                                                              │
│  FastAPI Application:                                                        │
│  ───────────────────                                                        │
│  • Combined HTTP + MCP endpoint server                                       │
│  • Rate limiting (100 req/min)                                               │
│  • Authentication verification                                               │
│  • Global model & embedding caches                                           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Authentication (verify_api_key)                                    │   │
│  │  ────────────────────────────────────                               │   │
│  │  1. Check X-API-Key header                                          │   │
│  │  2. Compare with MCP_API_KEY env var                                │   │
│  │  3. Enhanced logging:                                               │   │
│  │     • Client IP (request.client.host)                               │   │
│  │     • Endpoint path (request.url.path)                              │   │
│  │     • Error type (missing_key vs invalid_key)                       │   │
│  │  4. Return 401 if invalid                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Endpoints:                                                                  │
│  ─────────                                                                  │
│  • POST /mcp → MCP tool calls (authenticated)                                │
│  • GET /api/health → Health check (public)                                   │
│  • GET /api/health/detailed → Detailed health (public)                       │
│  • GET / → Web UI (public)                                                   │
│                                                                              │
│  MCP Tools:                                                                  │
│  ─────────                                                                  │
│  • store_memory(content, tags, memory_type, metadata)                        │
│  • retrieve_memory(query, n_results)                                         │
│  • recall_memory(time_query, n_results)                                      │
│  • search_by_tag(tags, n_results)                                            │
│  • check_database_health()                                                   │
│                                                                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             │ Storage Backend Interface
                             │
┌────────────────────────────▼────────────────────────────────────────────────┐
│                          STORAGE LAYER                                       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  ChromaDB Backend (current)                                          │  │
│  │  ──────────────────────────                                          │  │
│  │  Path: ~/Library/Application Support/mcp-memory/chroma_db            │  │
│  │  Collection: memory_collection                                       │  │
│  │  Embedding Model: sentence-transformers/all-MiniLM-L6-v2            │  │
│  │  Dimensions: 384                                                     │  │
│  │  Device: MPS (Apple Silicon)                                         │  │
│  │                                                                       │  │
│  │  Operations:                                                          │  │
│  │  • store(content, metadata) → Generate embedding + persist           │  │
│  │  • retrieve(query, n) → Semantic search via vector similarity        │  │
│  │  • get_stats() → Collection size, memory count                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  Alternative Backends:                                                       │
│  • SQLite-vec (fast, single-user)                                            │
│  • Hybrid (SQLite + Cloudflare sync)                                         │
│  • Cloudflare (D1 + Vectorize, production)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📊 Memory Retrieval Flow (Detailed)

```
User Message
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│ SESSION-START HOOK (runs once per session)               │
├──────────────────────────────────────────────────────────┤
│ 1. Detect Project Context                               │
│    ├─ Scan package.json, requirements.txt, Cargo.toml   │
│    ├─ Analyze git repository (commits, keywords)        │
│    └─ Extract: name, language, frameworks               │
│                                                          │
│ 2. Build Memory Query (3-phase search)                  │
│    ┌─────────────────────────────────────────────────┐  │
│    │ Phase 0: Git-aware search (3 slots, 4 queries) │  │
│    │  • [recent-development] git keywords            │  │
│    │  • [main-branch] latest changes                 │  │
│    │  • [important] key decisions                    │  │
│    │  • [architecture] system design                 │  │
│    └─────────────────────────────────────────────────┘  │
│    ┌─────────────────────────────────────────────────┐  │
│    │ Phase 1: Recent memories (last-week, 3 slots)  │  │
│    │  Query: "{project} recent insights decisions"  │  │
│    └─────────────────────────────────────────────────┘  │
│    ┌─────────────────────────────────────────────────┐  │
│    │ Phase 2: Important tagged (5 slots)            │  │
│    │  Query: "{project} important architecture"     │  │
│    └─────────────────────────────────────────────────┘  │
│                                                          │
│ 3. Query Memory Service (via MemoryClient)              │
│    ├─ Protocol: Auto (MCP → HTTP fallback)              │
│    ├─ Auth: X-API-Key header                            │
│    ├─ Request: retrieve_memory(query, n_results)        │
│    └─ Response: Array of memories with metadata         │
│                                                          │
│ 4. Score & Rank Memories                                │
│    ├─ Base score from semantic similarity               │
│    ├─ Boost: +20% for recency (last 7 days)             │
│    ├─ Boost: +15% for project name match                │
│    ├─ Boost: +10% for language match                    │
│    ├─ Boost: +10% for important tags                    │
│    └─ Sort by relevance score (descending)              │
│                                                          │
│ 5. Format Context Message                               │
│    ├─ Group by category (current dev, recent work)      │
│    ├─ Add timestamps (🕒 today, 📅 date)                │
│    ├─ Include top scored items (5-8 memories)           │
│    └─ Format as markdown with emojis                    │
│                                                          │
│ 6. Inject into Conversation                             │
│    └─ Display formatted context to user + Claude        │
│                                                          │
└──────────────────────────────────────────────────────────┘
    │
    │ Session continues...
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│ MID-CONVERSATION HOOK (Natural Triggers v7.1.0)          │
├──────────────────────────────────────────────────────────┤
│ 1. Pattern Detection (every user message)               │
│    ├─ Explicit patterns (51-70% confidence)             │
│    │   • "what did we decide" → 63%                     │
│    │   • "how did we implement" → 58%                   │
│    │   • "what was the approach" → 55%                  │
│    │                                                     │
│    ├─ Implicit patterns (30-50% confidence)             │
│    │   • Question about past work → 35%                 │
│    │   • Reference to previous decision → 40%           │
│    │   • Topic shift requiring context → 32%            │
│    │                                                     │
│    └─ Conversation analysis (tiered)                    │
│        • Extract topics, entities, intent               │
│        • Calculate semantic shift from prev message     │
│        • Apply context boosts                           │
│                                                          │
│ 2. Trigger Decision                                     │
│    IF confidence >= 60% AND cooldown elapsed            │
│    THEN executeMemoryTrigger()                          │
│    ELSE skip                                            │
│                                                          │
│ 3. Dynamic Memory Injection (if triggered)              │
│    ├─ Query: extracted topics from message              │
│    ├─ Limit: 3-5 memories (configurable)                │
│    ├─ Filter: exclude already loaded memories           │
│    └─ Format: compact inline context                    │
│                                                          │
└──────────────────────────────────────────────────────────┘
    │
    │ Session ends...
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│ SESSION-END HOOK (runs once at end)                      │
├──────────────────────────────────────────────────────────┤
│ 1. Analyze Conversation                                 │
│    ├─ Extract topics (implementation, debugging, etc)    │
│    ├─ Extract decisions (sentences with decision words)  │
│    ├─ Extract insights (learning language patterns)      │
│    ├─ Extract code changes (technical implementations)   │
│    └─ Extract next steps (future work indicators)        │
│                                                          │
│ 2. Calculate Confidence                                 │
│    confidence = min(1.0, total_extracted_items / 10)    │
│    Skip if confidence < 0.1                             │
│                                                          │
│ 3. Format Session Consolidation                         │
│    ├─ Title: "Session: {topics}"                        │
│    ├─ Summary: Key decisions & insights                 │
│    ├─ Tags: project + language + topics + frameworks    │
│    └─ Metadata: session analysis, project context       │
│                                                          │
│ 4. Store to Memory Service                              │
│    ├─ Tool: store_memory                                │
│    ├─ Type: session-summary                             │
│    └─ Result: content_hash for future reference         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 🔄 Data Structures

### Memory Object
```javascript
{
  content: "The team decided to switch from ChromaDB to SQLite-vec...",
  content_hash: "a1b2c3d4e5f6...",
  tags: ["mcp-memory-service", "architecture", "decision"],
  memory_type: "decision",
  metadata: {
    project_name: "mcp-memory-service",
    language: "Python",
    created_at: "2025-09-30T10:30:00Z",
    session_id: "abc-123",
    relevance_score: 0.85
  },
  distance: 0.234,  // Semantic similarity (lower = more similar)
  timestamp: "2025-09-30T10:30:00Z"
}
```

### Project Context
```javascript
{
  name: "mcp-memory-service",
  language: "Python",
  frameworks: ["FastAPI", "ChromaDB", "sentence-transformers"],
  path: "/Users/linuxbabe/mcp-memory-service",
  git: {
    commits: 10,
    keywords: ["fix", "add", "memory", "context", "improve"],
    changelogEntries: 3
  }
}
```

### MCP Tool Call (JSON-RPC 2.0)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "retrieve_memory",
    "arguments": {
      "query": "mcp-memory-service authentication decisions",
      "n_results": 5
    }
  }
}
```

### MCP Tool Response
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{'results': [{'content': '...', 'metadata': {...}}]}"
      }
    ]
  }
}
```

## 🎯 Performance Characteristics

### Natural Triggers v7.1.0
| Metric | Speed Profile | Balanced Profile | Memory-Aware Profile |
|--------|---------------|------------------|----------------------|
| Max Latency | <100ms | <200ms | <500ms |
| Enabled Tiers | Instant only | Instant + Fast | All 3 tiers |
| Trigger Rate | ~5% | ~11% | ~15% |
| False Positives | 0% | 0% | 0% |
| Pattern Accuracy | 85%+ | 85%+ | 85%+ |
| Background Processing | Disabled | Enabled | Enabled |

### Memory Operations
| Operation | ChromaDB | SQLite-vec | Hybrid | Cloudflare |
|-----------|----------|------------|--------|------------|
| Store | ~100ms | ~5ms | ~5ms | ~200ms |
| Retrieve | ~50ms | ~5ms | ~5ms | ~150ms |
| Health Check | ~10ms | <1ms | <1ms | ~50ms |

### Hook Execution Times
| Hook | Average | Max | Notes |
|------|---------|-----|-------|
| session-start | 300ms | 1000ms | Project detection + 3-phase search |
| mid-conversation | 2ms | 500ms | Pattern detection (tiered) |
| session-end | 200ms | 500ms | Conversation analysis + store |
| topic-change | 150ms | 300ms | Topic shift detection + query |

## 🔐 Security & Authentication

### Request Flow
```
Hook Request
    │
    ├─ Add Headers: X-API-Key: test-key-123
    │                Content-Type: application/json
    │
    ▼
Server verify_api_key()
    │
    ├─ Extract: request.client.host (127.0.0.1)
    ├─ Extract: request.url.path (/mcp)
    ├─ Extract: x_api_key header value
    │
    ├─ IF MCP_API_KEY not set
    │   └─ WARN + ALLOW (dev mode)
    │
    ├─ IF x_api_key missing OR x_api_key != expected
    │   ├─ LOG: "❌ Unauthorized from {ip} to {path} (missing: {bool}, invalid: {bool})"
    │   └─ RAISE: HTTPException(401)
    │
    └─ ELSE: ALLOW request
```

### Authentication Test Results
```
✅ Server accepts correct X-API-Key header (200)
✅ Server rejects missing API key (401)
✅ Server rejects invalid API key (401)
✅ Server rejects Authorization Bearer header (401)
✅ No hooks use Authorization: Bearer header
✅ Core hooks use X-API-Key header
✅ memory-client.js uses X-API-Key
✅ session-start hook executes without auth errors
✅ Server logs show enhanced auth error details
```

## 📈 Memory Lifecycle

```
┌─────────────┐
│ User writes │
│    code     │
└──────┬──────┘
       │
       │ Git commits contain
       │ decisions & changes
       ▼
┌──────────────────────────────────────┐
│ session-start hook                    │
│ • Analyzes git history               │
│ • Finds keywords: "fix", "add", etc  │
│ • Queries memories by keywords       │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Memory scoring                        │
│ • Base: semantic similarity          │
│ • +20% recent (last 7 days)          │
│ • +15% project match                 │
│ • +10% language match                │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Context injection                     │
│ Memories displayed to user + Claude  │
└──────┬───────────────────────────────┘
       │
       │ Conversation proceeds
       │
       ▼
┌──────────────────────────────────────┐
│ Natural triggers monitor messages     │
│ • Detect: "what did we decide"       │
│ • Confidence: 63%                    │
│ • Trigger: memory retrieval          │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ Dynamic memory injection              │
│ Relevant memories added mid-session  │
└──────┬───────────────────────────────┘
       │
       │ Session ends
       │
       ▼
┌──────────────────────────────────────┐
│ session-end hook                      │
│ • Analyze conversation               │
│ • Extract: topics, decisions         │
│ • Store session summary              │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ ChromaDB storage                      │
│ • Generate 384-dim embedding         │
│ • Store: content + metadata          │
│ • Index: for future semantic search  │
└──────────────────────────────────────┘
       │
       │ Next session
       │
       └─────► Memories retrieved again
```

## 🧩 Component Dependencies

```
session-start.js
    ├── utilities/memory-client.js
    │   ├── config.json (endpoint, apiKey)
    │   └── mcp_server.py (HTTP/MCP endpoint)
    │       └── storage/chroma.py (ChromaDB)
    │
    ├── utilities/project-detector.js
    │   ├── package.json, requirements.txt (language detection)
    │   └── .git/logs/HEAD (git analysis)
    │
    ├── utilities/memory-scorer.js
    │   └── Project context + memory metadata
    │
    └── utilities/context-formatter.js
        └── Scored memories array

mid-conversation-hook.js (Natural Triggers)
    ├── utilities/pattern-detector.js
    │   ├── Pattern matching rules
    │   └── Tiered processing config
    │
    ├── utilities/conversation-analyzer.js
    │   ├── Topic extraction
    │   ├── Entity detection
    │   └── Semantic shift calculation
    │
    └── utilities/memory-client.js
        └── [same as above]

session-end.js
    ├── utilities/memory-client.js
    │   └── [same as above]
    │
    └── utilities/context-formatter.js
        └── Session consolidation formatting

topic-change.js
    ├── utilities/conversation-analyzer.js
    └── utilities/memory-client.js

memory-retrieval.js (manual)
    └── utilities/memory-client.js
```

## 🎛️ Configuration Flow

```
~/.claude/hooks/config.json
    │
    ├─ memoryService
    │   ├─ protocol: "auto"
    │   ├─ preferredProtocol: "mcp"
    │   ├─ http.endpoint: "https://localhost:8443"
    │   ├─ http.apiKey: "test-key-123"
    │   └─ mcp.serverCommand: ["uv", "run", "memory", "server"]
    │
    ├─ naturalTriggers
    │   ├─ enabled: true
    │   ├─ triggerThreshold: 0.6
    │   ├─ cooldownPeriod: 30000
    │   └─ maxMemoriesPerTrigger: 5
    │
    ├─ performance
    │   ├─ defaultProfile: "memory_aware"
    │   ├─ enableMonitoring: true
    │   └─ autoAdjust: true
    │
    └─ hooks
        ├─ sessionStart.maxMemories: 8
        ├─ topicChange.enabled: true
        └─ sessionEnd.minSessionLength: 100

                    ↓ Loaded by hooks

Memory Client → Protocol Detection
    │
    ├─ IF protocol == "auto"
    │   ├─ 1. Try MCP (check if server process reachable)
    │   ├─ 2. Fallback to HTTP (check /api/health)
    │   └─ 3. Use preferredProtocol from config
    │
    ├─ IF protocol == "mcp"
    │   └─ Connect to: uv run memory server
    │
    └─ IF protocol == "http"
        └─ Connect to: https://localhost:8443
```

## 🚀 Request Examples

### Store Memory (session-end)
```javascript
// Hook: session-end.js
const postData = JSON.stringify({
  content: "Session: Fixed auth headers - All hooks now use X-API-Key...",
  tags: ["claude-code-session", "mcp-memory-service", "authentication"],
  memory_type: "session-summary",
  metadata: {
    session_analysis: {
      topics: ["authentication", "debugging", "testing"],
      decisions_count: 2,
      insights_count: 1,
      confidence: 0.8
    },
    project_context: {
      name: "mcp-memory-service",
      language: "Python",
      frameworks: ["FastAPI"]
    },
    generated_by: "claude-code-session-end-hook"
  }
});

// HTTP Request
https.request({
  hostname: "localhost",
  port: 8443,
  path: "/api/memories",
  method: "POST",
  headers: {
    "X-API-Key": "test-key-123",
    "Content-Type": "application/json"
  }
});
```

### Retrieve Memory (session-start)
```javascript
// Hook: session-start.js
const postData = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "retrieve_memory",
    arguments: {
      query: "mcp-memory-service recent development fix add memory context last-2-weeks",
      n_results: 3
    }
  }
});

// HTTP Request to MCP endpoint
https.request({
  hostname: "localhost",
  port: 8443,
  path: "/mcp",
  method: "POST",
  headers: {
    "X-API-Key": "test-key-123",
    "Content-Type": "application/json"
  }
});
```

---

**Last Updated:** 2025-09-30
**System Version:** Natural Triggers v7.1.0
**Storage Backend:** ChromaDB
**Authentication:** X-API-Key (verified working)