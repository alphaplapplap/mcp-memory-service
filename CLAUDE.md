# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this MCP Memory Service repository.

> **Note**: Comprehensive project context has been stored in memory with tags `claude-code-reference`. Use memory retrieval to access detailed information during development.

## Overview

MCP Memory Service is a Model Context Protocol server providing semantic memory and persistent storage for Claude Desktop using ChromaDB and sentence transformers.

> **🧠 v7.1.0**: Now features **Natural Memory Triggers** with intelligent automatic memory retrieval, 85%+ trigger accuracy, and multi-tier performance optimization!

> **🚀 v7.0.0**: Features **OAuth 2.1 Dynamic Client Registration** and **Dual Protocol Memory Hooks** for Claude Code with automatic HTTP/MCP protocol detection.

## Essential Commands

```bash
# Setup & Development
python scripts/installation/install.py         # Platform-aware installation with backend selection
python scripts/installation/install.py --storage-backend hybrid      # Hybrid setup (RECOMMENDED)
python scripts/installation/install.py --storage-backend cloudflare  # Direct Cloudflare setup
uv run memory server                           # Start server (v6.3.0+ consolidated CLI)
pytest tests/                                 # Run tests
python scripts/validation/verify_environment.py # Check environment
python scripts/validation/validate_configuration_complete.py   # Comprehensive configuration validation

# Memory Operations (requires: python scripts/utils/claude_commands_utils.py)
claude /memory-store "content"                 # Store information
claude /memory-recall "query"                  # Retrieve information
claude /memory-health                         # Check service status

# Configuration Validation
python scripts/validation/diagnose_backend_config.py  # Validate Cloudflare configuration

# Backend Synchronization
python scripts/sync/sync_memory_backends.py --status    # Check sync status
python scripts/sync/sync_memory_backends.py --dry-run   # Preview sync
python scripts/sync/claude_sync_commands.py backup      # Cloudflare → SQLite
python scripts/sync/claude_sync_commands.py restore     # SQLite → Cloudflare

# Service Management
scripts/service/memory_service_manager.sh status       # Check service status
scripts/service/memory_service_manager.sh start-cloudflare # Start with Cloudflare

# Natural Memory Triggers v7.1.0 (Latest)
node ~/.claude/hooks/memory-mode-controller.js status   # Check trigger system status
node ~/.claude/hooks/memory-mode-controller.js profile balanced  # Switch performance profile
node ~/.claude/hooks/memory-mode-controller.js sensitivity 0.7   # Adjust trigger sensitivity
node ~/.claude/hooks/test-natural-triggers.js          # Test trigger system

# Debug & Troubleshooting
npx @modelcontextprotocol/inspector uv run memory server # MCP Inspector
python scripts/database/simple_timestamp_check.py       # Database health check
df -h /                                               # Check disk space (critical for Litestream)
journalctl -u mcp-memory-service -f                   # Monitor service logs
```

## Architecture

**Core Components:**
- **Server Layer**: MCP protocol implementation with async handlers and global caches (`src/mcp_memory_service/server.py`)
- **Storage Backends**: SQLite-Vec (fast, single-client), ChromaDB (multi-client), Cloudflare (production)
- **Web Interface**: FastAPI dashboard at `https://localhost:8443/` with REST API
- **Dual Protocol Memory Hooks** 🆕: Advanced Claude Code integration with HTTP + MCP support
  - **HTTP Protocol**: Web-based memory service connection (`https://localhost:8443/api/*`)
  - **MCP Protocol**: Direct server process communication (`uv run memory server`)
  - **Smart Auto-Detection**: MCP preferred → HTTP fallback → Environment detection
  - **Unified Interface**: Transparent protocol switching via `MemoryClient` wrapper

**Key Design Patterns:**
- Async/await for all I/O operations
- Type safety with Python 3.10+ hints
- Platform detection for hardware optimization (CUDA, MPS, DirectML, ROCm)
- Global model and embedding caches for performance
- **Protocol Abstraction** 🆕: Single interface for multi-protocol memory operations

## Environment Variables

**Essential Configuration:**
```bash
# Storage Backend (ChromaDB recommended for local development)
export MCP_MEMORY_STORAGE_BACKEND=chroma  # chroma|sqlite_vec|cloudflare|hybrid

# ChromaDB Configuration (RECOMMENDED for local use)
export MCP_MEMORY_CHROMA_PATH="~/.mcp-memory/chroma"  # Local ChromaDB path
export CHROMA_TELEMETRY_ENABLED=False  # Disable telemetry

# Cloudflare Configuration (OPTIONAL - for remote/cloud deployments)
# export CLOUDFLARE_API_TOKEN="your-token"
# export CLOUDFLARE_ACCOUNT_ID="your-account"
# export CLOUDFLARE_D1_DATABASE_ID="your-d1-id"
# export CLOUDFLARE_VECTORIZE_INDEX="mcp-memory-index"

# Web Interface (Optional)
export MCP_HTTP_ENABLED=true                  # Enable HTTP server
export MCP_HTTPS_ENABLED=false                # HTTPS (use true for production)
export MCP_API_KEY="$(openssl rand -base64 32)" # Generate secure API key
```

**Configuration Precedence:** Global Claude Config > .env file > Environment variables

**✅ Automatic Configuration Loading (v6.16.0+):** The service now automatically loads `.env` files and respects environment variable precedence. CLI defaults no longer override environment configuration.

**💡 Storage Backend Selection:** Choose the backend that fits your use case:
- **ChromaDB**: Recommended for local development and single-user setups (fast, reliable)
- **Hybrid**: Best for production with local speed + cloud backup
- **Cloudflare**: For pure cloud deployments or multi-device sync
- **SQLite-vec**: Lightweight alternative for constrained environments

**Platform Support:** macOS (MPS/CPU), Windows (CUDA/DirectML/CPU), Linux (CUDA/ROCm/CPU)

## Claude Code Hooks Configuration 🆕

### Natural Memory Triggers v7.1.0 (Latest)

**Intelligent automatic memory retrieval** with advanced semantic analysis and multi-tier performance optimization:

```bash
# Setup: Configure mid-conversation hook in ~/.claude/settings.json
# Add to "UserPromptSubmit" hooks section:
# "command": "node ~/.claude/hooks/core/mid-conversation.js"

# CLI Management (works without restart)
node ~/.claude/hooks/memory-mode-controller.js status
node ~/.claude/hooks/memory-mode-controller.js profile balanced
node ~/.claude/hooks/memory-mode-controller.js sensitivity 0.6
```

**Key Features:**
- ✅ **85%+ trigger accuracy** for memory-seeking pattern detection
- ✅ **Multi-tier processing**: 50ms instant → 150ms fast → 500ms intensive
- ✅ **CLI management system** for real-time configuration without restart
- ✅ **Git-aware context** integration for enhanced memory relevance
- ✅ **Adaptive learning** based on user preferences and usage patterns

**Configuration (`~/.claude/hooks/config.json`):**
```json
{
  "naturalTriggers": {
    "enabled": true,
    "triggerThreshold": 0.6,
    "cooldownPeriod": 30000,
    "maxMemoriesPerTrigger": 5
  },
  "performance": {
    "defaultProfile": "balanced",
    "enableMonitoring": true,
    "autoAdjust": true
  }
}
```

**Performance Profiles:**
- `speed_focused`: <100ms, instant tier only - minimal memory awareness for speed
- `balanced`: <200ms, instant + fast tiers - optimal for general development (recommended)
- `memory_aware`: <500ms, all tiers - maximum context awareness for complex work
- `adaptive`: Dynamic adjustment based on usage patterns and user feedback

### Dual Protocol Memory Hooks (Legacy)

**Dual Protocol Memory Hooks** (v7.0.0+) provide intelligent memory awareness with automatic protocol detection:

```json
{
  "memoryService": {
    "protocol": "auto",
    "preferredProtocol": "mcp",
    "fallbackEnabled": true,
    "http": {
      "endpoint": "https://localhost:8443",
      "apiKey": "your-api-key",
      "healthCheckTimeout": 3000,
      "useDetailedHealthCheck": true
    },
    "mcp": {
      "serverCommand": ["uv", "run", "memory", "server", "-s", "cloudflare"],
      "serverWorkingDir": "/Users/yourname/path/to/mcp-memory-service",
      "connectionTimeout": 5000,
      "toolCallTimeout": 10000
    }
  }
}
```

**Protocol Options:**
- `"auto"`: Smart detection (MCP → HTTP → Environment fallback)
- `"http"`: HTTP-only mode (web server at localhost:8443)
- `"mcp"`: MCP-only mode (direct server process)

**Benefits:**
- **Reliability**: Multiple connection methods ensure hooks always work
- **Performance**: MCP direct for speed, HTTP for stability
- **Flexibility**: Works with local development or remote deployments
- **Compatibility**: Full backward compatibility with existing configurations

## Storage Backends

| Backend | Performance | Use Case | Installation |
|---------|-------------|----------|--------------|
| **ChromaDB** 👥 | **Fast (10ms read)** | **🌟 Local Development (Recommended)** | `install.py --storage-backend chromadb` |
| **Hybrid** ⚡ | Fast (5ms read) | Production with cloud sync | `install.py --storage-backend hybrid` |
| SQLite-Vec 🪶 | Fast (5ms read) | Lightweight, single-user | `install.py --storage-backend sqlite_vec` |
| **Cloudflare** ☁️ | Network dependent | Cloud-only deployments | `install.py --storage-backend cloudflare` |

### 🚀 **Hybrid Backend (v6.21.0+)**

The **Hybrid backend** provides the best of both worlds - **SQLite-vec speed with Cloudflare persistence** for production deployments requiring cloud backup:

```bash
# Enable hybrid backend
export MCP_MEMORY_STORAGE_BACKEND=hybrid

# Hybrid-specific configuration
export MCP_HYBRID_SYNC_INTERVAL=300    # Background sync every 5 minutes
export MCP_HYBRID_BATCH_SIZE=50        # Sync 50 operations at a time
export MCP_HYBRID_SYNC_ON_STARTUP=true # Initial sync on startup

# Requires Cloudflare credentials (same as cloudflare backend)
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account"
export CLOUDFLARE_D1_DATABASE_ID="your-d1-id"
export CLOUDFLARE_VECTORIZE_INDEX="mcp-memory-index"
```

**Key Benefits:**
- ✅ **5ms read/write performance** (SQLite-vec speed)
- ✅ **Zero user-facing latency** - Cloud sync happens in background
- ✅ **Multi-device synchronization** - Access memories everywhere
- ✅ **Graceful offline operation** - Works without internet, syncs when available
- ✅ **Automatic failover** - Falls back to SQLite-only if Cloudflare unavailable

**Architecture:**
- **Primary Storage**: SQLite-vec (all user operations)
- **Secondary Storage**: Cloudflare (background sync)
- **Background Service**: Async queue with retry logic and health monitoring

**v6.16.0+ Installer Enhancements:**
- **Interactive backend selection** with usage-based recommendations
- **Automatic Cloudflare credential setup** and `.env` file generation
- **Connection testing** during installation to validate configuration
- **Graceful fallbacks** from cloud to local backends if setup fails

## Development Guidelines

- Use `claude /memory-store` to capture decisions during development
- Memory operations handle duplicates via content hashing
- Time parsing supports natural language ("yesterday", "last week")
- Storage backends must implement abstract base class
- All features require corresponding tests
- Use semantic commit messages for version management
- Run `python scripts/validation/validate_configuration_complete.py` when troubleshooting setup issues
- Use sync utilities for hybrid Cloudflare/SQLite deployments

## Key Endpoints

- **Health**: `https://localhost:8443/api/health`
- **Web UI**: `https://localhost:8443/`  
- **API**: `https://localhost:8443/api/memories`
- **Wiki**: `https://github.com/doobidoo/mcp-memory-service/wiki`

## Configuration Management

**Validation & Troubleshooting:**
```bash
python scripts/validation/validate_configuration_complete.py  # Comprehensive configuration validation
```

**Single Source of Truth:**
- **Global Configuration**: `~/.claude.json` (authoritative for all projects)
- **Project Environment**: `.env` file (Cloudflare credentials only)
- **No Local Overrides**: Project `.mcp.json` should NOT contain memory server config

**Common Configuration Issues (Pre-v6.16.0):**
- **✅ FIXED**: CLI defaults overriding environment variables
- **✅ FIXED**: Manual .env file loading required
- **Multiple Backends**: Conflicting SQLite/Cloudflare configurations
- **Credential Conflicts**: Old macOS paths or missing Cloudflare credentials
- **Cache Issues**: Restart Claude Code to refresh MCP connections

**v6.16.0+ Configuration Benefits:**
- **Automatic .env loading**: No manual configuration required
- **Proper precedence**: Environment variables respected over CLI defaults
- **Better error messages**: Clear indication of configuration loading issues

**Cloudflare Backend Troubleshooting:**
- **Enhanced Initialization Logging**: Look for these indicators in Claude Desktop logs:
  - 🚀 SERVER INIT: Main server initialization flow
  - ☁️ Cloudflare-specific initialization steps
  - ✅ Success markers for each phase
  - ❌ Error details with full tracebacks
  - 🔍 Storage type verification (confirms final backend)
- **Common Issues**:
  - Silent fallback to SQLite-vec: Check logs for eager initialization timeout or API errors
  - Configuration validation: Environment variables are logged during startup
  - Network timeouts: Enhanced error messages show specific Cloudflare API failures

**Dual Environment Setup (Claude Desktop + Claude Code):**
```bash
# Quick setup for both environments - see docs/quick-setup-cloudflare-dual-environment.md
python scripts/validation/diagnose_backend_config.py  # Validate Cloudflare configuration
claude mcp list                             # Check Claude Code MCP servers
```

**Troubleshooting Health Check Showing Wrong Backend:**
```bash
# If health check shows "sqlite-vec" instead of "cloudflare":
python scripts/validation/diagnose_backend_config.py  # Check configuration
claude mcp remove memory && claude mcp add memory python -e MCP_MEMORY_STORAGE_BACKEND=cloudflare -e CLOUDFLARE_API_TOKEN=your-token -- -m mcp_memory_service.server
```

**Emergency Debugging:**
```bash
/mcp                                         # Check active MCP servers in Claude
python scripts/validation/diagnose_backend_config.py  # Run configuration validation
rm -f .mcp.json                             # Remove conflicting local MCP config
python debug_server_initialization.py       # Test initialization flows (v6.15.1+)
tail -50 ~/Library/Logs/Claude/mcp-server-memory.log | grep -E "(🚀|☁️|✅|❌)" # View enhanced logs
```

> **For detailed troubleshooting, architecture, and deployment guides, retrieve memories tagged with `claude-code-reference` or visit the project wiki.**
- always use "/gemini review" when commenting on a PR
- make sure to have commited and pushed every change to the branch before commenting on the PR and before triggering gemini Code Assist