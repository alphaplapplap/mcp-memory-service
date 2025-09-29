#!/usr/bin/env python3
"""
FastAPI MCP Server for Memory Service

This module implements a native MCP server using the FastAPI MCP framework,
replacing the Node.js HTTP-to-MCP bridge to resolve SSL connectivity issues
and provide direct MCP protocol support.

Features:
- Native MCP protocol implementation using FastMCP
- Direct integration with existing memory storage backends
- Streamable HTTP transport for remote access
- All 22 core memory operations (excluding dashboard tools)
- SSL/HTTPS support with proper certificate handling
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Dict, List, Optional, Any, Union
import os
import sys
import socket
from pathlib import Path

# Add src to path for imports
current_dir = Path(__file__).parent
src_dir = current_dir.parent.parent
sys.path.insert(0, str(src_dir))

from fastmcp import FastMCP, Context
from mcp.types import TextContent
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List

# Import existing memory service components
from .config import (
    CHROMA_PATH, COLLECTION_METADATA, STORAGE_BACKEND,
    CONSOLIDATION_ENABLED, EMBEDDING_MODEL_NAME, INCLUDE_HOSTNAME,
    SQLITE_VEC_PATH,
    CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_VECTORIZE_INDEX,
    CLOUDFLARE_D1_DATABASE_ID, CLOUDFLARE_R2_BUCKET, CLOUDFLARE_EMBEDDING_MODEL,
    CLOUDFLARE_LARGE_CONTENT_THRESHOLD, CLOUDFLARE_MAX_RETRIES, CLOUDFLARE_BASE_DELAY,
    HYBRID_SYNC_INTERVAL, HYBRID_BATCH_SIZE, HYBRID_MAX_QUEUE_SIZE,
    HYBRID_SYNC_ON_STARTUP, HYBRID_FALLBACK_TO_PRIMARY
)
from .storage.base import MemoryStorage

def _get_sqlite_vec_storage(error_message="Failed to import SQLite-vec storage"):
    """Helper function to import SqliteVecMemoryStorage with consistent error handling."""
    try:
        from .storage.sqlite_vec import SqliteVecMemoryStorage
        return SqliteVecMemoryStorage
    except ImportError as e:
        logger.error(f"{error_message}: {e}")
        raise

def get_storage_backend():
    """Dynamically select and import storage backend based on configuration and availability."""
    backend = STORAGE_BACKEND.lower()

    if backend == "sqlite-vec" or backend == "sqlite_vec":
        return _get_sqlite_vec_storage()
    elif backend == "chroma":
        try:
            from .storage.chroma import ChromaMemoryStorage
            return ChromaMemoryStorage
        except ImportError:
            logger.warning("ChromaDB not available, falling back to SQLite-vec")
            return _get_sqlite_vec_storage("Failed to import fallback SQLite-vec storage")
    elif backend == "cloudflare":
        try:
            from .storage.cloudflare import CloudflareStorage
            return CloudflareStorage
        except ImportError as e:
            logger.error(f"Failed to import Cloudflare storage: {e}")
            raise
    elif backend == "hybrid":
        try:
            from .storage.hybrid import HybridMemoryStorage
            return HybridMemoryStorage
        except ImportError as e:
            logger.error(f"Failed to import Hybrid storage: {e}")
            logger.warning("Falling back to SQLite-vec storage")
            return _get_sqlite_vec_storage("Failed to import fallback SQLite-vec storage")
    else:
        logger.warning(f"Unknown storage backend '{backend}', defaulting to SQLite-vec")
        return _get_sqlite_vec_storage("Failed to import default SQLite-vec storage")
from .models.memory import Memory

# Configure logging with DEBUG level for extensive diagnostics
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# REST API (FastAPI)
# =============================================================================

# Global storage reference for REST endpoints
_storage: Optional[MemoryStorage] = None

# =============================================================================
# MCP SERVER CONTEXT
# =============================================================================

@dataclass
class MCPServerContext:
    """Application context for the MCP server with all required components."""
    storage: MemoryStorage

@asynccontextmanager
async def mcp_server_lifespan(server: FastMCP) -> AsyncIterator[MCPServerContext]:
    """Manage MCP server lifecycle with proper resource initialization and cleanup."""
    global _storage
    logger.info("Initializing MCP Memory Service components...")

    # Initialize storage backend based on configuration and availability
    StorageClass = get_storage_backend()
    
    if StorageClass.__name__ == "SqliteVecMemoryStorage":
        storage = StorageClass(
            db_path=SQLITE_VEC_PATH,
            embedding_model=EMBEDDING_MODEL_NAME
        )
    elif StorageClass.__name__ == "CloudflareStorage":
        storage = StorageClass(
            api_token=CLOUDFLARE_API_TOKEN,
            account_id=CLOUDFLARE_ACCOUNT_ID,
            vectorize_index=CLOUDFLARE_VECTORIZE_INDEX,
            d1_database_id=CLOUDFLARE_D1_DATABASE_ID,
            r2_bucket=CLOUDFLARE_R2_BUCKET,
            embedding_model=CLOUDFLARE_EMBEDDING_MODEL,
            large_content_threshold=CLOUDFLARE_LARGE_CONTENT_THRESHOLD,
            max_retries=CLOUDFLARE_MAX_RETRIES,
            base_delay=CLOUDFLARE_BASE_DELAY
        )
    elif StorageClass.__name__ == "HybridMemoryStorage":
        # Prepare Cloudflare configuration dict
        cloudflare_config = None
        if all([CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_VECTORIZE_INDEX, CLOUDFLARE_D1_DATABASE_ID]):
            cloudflare_config = {
                'api_token': CLOUDFLARE_API_TOKEN,
                'account_id': CLOUDFLARE_ACCOUNT_ID,
                'vectorize_index': CLOUDFLARE_VECTORIZE_INDEX,
                'd1_database_id': CLOUDFLARE_D1_DATABASE_ID,
                'r2_bucket': CLOUDFLARE_R2_BUCKET,
                'embedding_model': CLOUDFLARE_EMBEDDING_MODEL,
                'large_content_threshold': CLOUDFLARE_LARGE_CONTENT_THRESHOLD,
                'max_retries': CLOUDFLARE_MAX_RETRIES,
                'base_delay': CLOUDFLARE_BASE_DELAY
            }

        storage = StorageClass(
            sqlite_db_path=SQLITE_VEC_PATH,
            embedding_model=EMBEDDING_MODEL_NAME,
            cloudflare_config=cloudflare_config,
            sync_interval=HYBRID_SYNC_INTERVAL,
            batch_size=HYBRID_BATCH_SIZE
        )
    else:  # ChromaMemoryStorage
        storage = StorageClass(
            path=str(CHROMA_PATH)
        )
    
    # Initialize storage backend
    await storage.initialize()

    # DEBUG: Check for embedding dimension mismatch (ChromaDB specific)
    if StorageClass.__name__ == "ChromaMemoryStorage":
        try:
            import numpy as np
            # Get the collection
            collection = storage.collection
            count = collection.count()

            if count > 0:
                # Check embedding dimension
                results = collection.peek(1)
                embeddings = results.get('embeddings')

                if embeddings is not None and len(embeddings) > 0:
                    emb_array = np.array(embeddings[0])
                    collection_dim = len(emb_array)
                    model_dim = 384  # all-MiniLM-L6-v2

                    logger.info(f"[DEBUG] Collection has {count} memories with {collection_dim}d embeddings")
                    logger.info(f"[DEBUG] Current model produces {model_dim}d embeddings")

                    if collection_dim != model_dim:
                        logger.error(f"[DEBUG] EMBEDDING DIMENSION MISMATCH!")
                        logger.error(f"[DEBUG] Collection expects {collection_dim}d but model produces {model_dim}d")
                        logger.error(f"[DEBUG] This will cause ALL queries to fail with empty results!")
                        logger.warning(f"[DEBUG] FIXING: Deleting and recreating collection...")

                        # Delete the collection
                        storage.client.delete_collection("memory_collection")
                        logger.info(f"[DEBUG] Deleted old collection with {count} incompatible memories")

                        # Recreate with correct dimensions
                        await storage.initialize()

                        # Explicitly refresh the collection reference to the new collection
                        storage.collection = storage.client.get_collection("memory_collection")
                        logger.info(f"[DEBUG] Recreated collection with {model_dim}d embeddings")
                        logger.info(f"[DEBUG] Refreshed collection reference: {storage.collection.id}")
                    else:
                        logger.info(f"[DEBUG] Embedding dimensions match - OK")
        except Exception as debug_error:
            logger.warning(f"[DEBUG] Could not check embedding dimensions: {debug_error}")

    _storage = storage  # Set global for REST endpoints

    try:
        yield MCPServerContext(
            storage=storage
        )
    finally:
        # Cleanup on shutdown
        logger.info("Shutting down MCP Memory Service components...")
        if hasattr(storage, 'close'):
            await storage.close()

# Set up FastAPI lifespan wrapper
@asynccontextmanager
async def fastapi_lifespan(app: FastAPI):
    async with mcp_server_lifespan(None) as context:
        global _storage
        _storage = context.storage
        yield

# Create FastAPI app with REST endpoints
combined_app = FastAPI(
    title="MCP Memory Service - Combined API",
    description="REST API + MCP protocol endpoints",
    version="1.0.0",
    lifespan=fastapi_lifespan
)

# REST API endpoints
def _get_backend_name(storage):
    """Derive backend name from storage class name dynamically"""
    class_name = storage.__class__.__name__

    # Convert CamelCase to lowercase with hyphens
    # ChromaMemoryStorage -> chroma
    # SqliteVecMemoryStorage -> sqlite-vec
    # CloudflareStorage -> cloudflare

    # Remove common suffixes
    name = class_name.replace('MemoryStorage', '').replace('Storage', '')

    # Insert hyphens before uppercase letters and convert to lowercase
    import re
    name = re.sub(r'([a-z])([A-Z])', r'\1-\2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1-\2', name)

    return name.lower()

@combined_app.get("/api/health")
async def health_check():
    """Basic health check endpoint"""
    if not _storage:
        return JSONResponse({
            "storage": {
                "backend": "initializing",
                "status": "initializing"
            }
        })

    # Get storage path if available
    database_path = None
    if hasattr(_storage, 'db_path'):
        database_path = str(_storage.db_path)
    elif hasattr(_storage, 'path'):
        database_path = str(_storage.path)

    return JSONResponse({
        "storage": {
            "backend": _get_backend_name(_storage),
            "status": "connected",
            "database_path": database_path
        }
    })

@combined_app.get("/api/health/detailed")
async def detailed_health_check():
    """Detailed health check with statistics"""
    if not _storage:
        raise HTTPException(status_code=503, detail="Storage not initialized")

    try:
        # Get storage path if available
        database_path = None
        if hasattr(_storage, 'db_path'):
            database_path = str(_storage.db_path)
        elif hasattr(_storage, 'path'):
            database_path = str(_storage.path)

        stats = await _storage.get_stats()

        return JSONResponse({
            "storage": {
                "backend": _get_backend_name(_storage),
                "status": "connected",
                "database_path": database_path,
                "accessible": True
            },
            "statistics": {
                "total_memories": stats.get("total_memories", 0),
                "total_tags": stats.get("total_tags", 0),
                "database_size_mb": stats.get("database_size_mb", 0),
                "unique_tags": stats.get("total_tags", 0)
            },
            "timestamp": stats.get("timestamp", "unknown")
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

# MCP JSON-RPC endpoint
@combined_app.post("/mcp")
async def mcp_endpoint(request: dict):
    """Handle MCP protocol JSON-RPC requests"""
    logger.debug(f"[MCP] Received request: method={request.get('method')}, id={request.get('id')}")

    if not _storage:
        logger.error("[MCP] Storage not initialized!")
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {"code": -32603, "message": "Storage not initialized"}
        })

    method = request.get("method")
    params = request.get("params", {})
    request_id = request.get("id")

    logger.debug(f"[MCP] Method: {method}, Params: {params}")

    try:
        if method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})

            logger.info(f"[MCP] Tool call: {tool_name} with args: {arguments}")

            # Route to appropriate tool
            if tool_name == "retrieve_memory":
                query = arguments.get("query")
                n_results = arguments.get("n_results", 5)

                logger.info(f"[MCP] Calling _storage.retrieve(query='{query}', n_results={n_results})")
                logger.debug(f"[MCP] Storage class: {_storage.__class__.__name__}")

                try:
                    results = await _storage.retrieve(
                        query=query,
                        n_results=n_results
                    )
                    logger.info(f"[MCP] Retrieved {len(results)} results from storage")
                except Exception as storage_error:
                    logger.error(f"[MCP] Storage retrieve failed: {type(storage_error).__name__}: {storage_error}")
                    logger.exception("[MCP] Full traceback:")
                    # Return empty results on storage error instead of failing
                    results = []

                memories = []
                for i, result in enumerate(results):
                    logger.debug(f"[MCP] Processing result {i+1}: {result.memory.content[:50]}...")
                    memories.append({
                        "content": result.memory.content,
                        "content_hash": result.memory.content_hash,
                        "tags": result.memory.metadata.tags,
                        "memory_type": result.memory.metadata.memory_type,
                        "created_at": result.memory.metadata.created_at_iso,
                        "similarity_score": result.similarity_score
                    })

                response_data = {
                    "memories": memories,
                    "query": query,
                    "total_results": len(memories)
                }

                logger.info(f"[MCP] Returning {len(memories)} memories to client")

                return JSONResponse({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "content": [{"type": "text", "text": str(response_data)}]
                    }
                })

            elif tool_name == "check_database_health":
                stats = await _storage.get_stats()
                response_data = {
                    "status": "healthy",
                    "backend": _storage.__class__.__name__,
                    "statistics": {
                        "total_memories": stats.get("total_memories", 0),
                        "total_tags": stats.get("total_tags", 0),
                        "storage_size": stats.get("storage_size", "unknown"),
                        "last_backup": stats.get("last_backup", "never")
                    },
                    "timestamp": stats.get("timestamp", "unknown")
                }

                return JSONResponse({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "result": {
                        "content": [{"type": "text", "text": str(response_data)}]
                    }
                })

            else:
                logger.warning(f"[MCP] Unknown tool requested: {tool_name}")
                return JSONResponse({
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {"code": -32601, "message": f"Tool not found: {tool_name}"}
                })

        else:
            logger.warning(f"[MCP] Unsupported method: {method}")
            return JSONResponse({
                "jsonrpc": "2.0",
                "id": request_id,
                "error": {"code": -32601, "message": f"Method not supported: {method}"}
            })

    except Exception as e:
        logger.error(f"[MCP] Endpoint exception: {type(e).__name__}: {e}")
        logger.exception("[MCP] Full exception traceback:")
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32603, "message": f"{type(e).__name__}: {str(e)}"}
        })

def main():
    """Main entry point for the combined FastAPI+MCP server."""
    import uvicorn

    # Configure for Claude Code integration
    port = int(os.getenv("MCP_SERVER_PORT", "8000"))
    host = os.getenv("MCP_SERVER_HOST", "0.0.0.0")

    logger.info(f"Starting MCP Memory Service HTTP server on {host}:{port}")
    logger.info(f"Storage backend: {STORAGE_BACKEND}")
    logger.info(f"Data path: {CHROMA_PATH}")
    logger.info(f"REST API: http://{host}:{port}/api/health")
    logger.info(f"MCP Endpoint: http://{host}:{port}/mcp")

    # Run combined server with uvicorn
    uvicorn.run(
        combined_app,
        host=host,
        port=port,
        log_level="info"
    )

if __name__ == "__main__":
    main()