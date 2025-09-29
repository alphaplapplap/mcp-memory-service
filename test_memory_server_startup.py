#!/usr/bin/env python
"""Test memory server startup with ChromaDB backend."""

import sys
import os
import asyncio
import logging
import traceback

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set environment variables before imports
os.environ['MCP_MEMORY_STORAGE_BACKEND'] = 'chroma'
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

async def test_chromadb_storage():
    """Test if ChromaDB storage can initialize and store a memory."""
    try:
        print("\n=== Testing ChromaDB Storage ===")

        # Import the storage module
        from src.mcp_memory_service.storage.chroma import ChromaMemoryStorage
        from src.mcp_memory_service.models.memory import Memory

        # Create storage instance
        storage_path = os.path.expanduser("~/.mcp-memory-service/chroma_test")
        os.makedirs(storage_path, exist_ok=True)

        print("Initializing ChromaDB storage...")
        storage = ChromaMemoryStorage(path=storage_path, preload_model=True)

        # Check initialization
        if storage.is_initialized():
            print("✓ Storage initialized successfully")

            # Test storing a memory
            print("\nTesting memory storage...")
            test_memory = Memory(
                content="This is a test memory for ChromaDB",
                tags=["test", "chromadb"],
                memory_type="test"
            )

            success, message = await storage.store(test_memory)
            if success:
                print(f"✓ Memory stored: {message}")
            else:
                print(f"✗ Failed to store memory: {message}")

            # Test retrieving memories
            print("\nTesting memory retrieval...")
            results = await storage.retrieve("test memory", n_results=1)
            if results:
                print(f"✓ Retrieved {len(results)} memories")
                for r in results:
                    print(f"  - Content: {r.memory.content[:50]}...")
            else:
                print("✗ No memories retrieved")

        else:
            print("✗ Storage not properly initialized")
            status = storage.get_initialization_status()
            print("Initialization status:")
            for key, value in status.items():
                print(f"  {key}: {value}")

    except Exception as e:
        print(f"\n✗ Error testing ChromaDB storage: {e}")
        logger.error(traceback.format_exc())
        return False

    return True

async def test_memory_server():
    """Test if the memory server can start up."""
    try:
        print("\n=== Testing Memory Server Startup ===")

        # Import server module
        from src.mcp_memory_service.server import main as server_main

        print("Starting memory server...")
        # Create a task for the server
        server_task = asyncio.create_task(server_main())

        # Wait a bit to see if it starts
        await asyncio.sleep(3)

        if not server_task.done():
            print("✓ Server appears to be running")
            server_task.cancel()
            try:
                await server_task
            except asyncio.CancelledError:
                pass
        else:
            # Check if it errored
            try:
                await server_task
                print("✓ Server started and completed")
            except Exception as e:
                print(f"✗ Server failed with error: {e}")
                return False

    except Exception as e:
        print(f"\n✗ Error testing server: {e}")
        logger.error(traceback.format_exc())
        return False

    return True

async def main():
    """Run all tests."""
    print("=" * 60)
    print("Memory Service ChromaDB Test")
    print("=" * 60)

    # Test storage first
    storage_ok = await test_chromadb_storage()

    if storage_ok:
        # Test server startup
        server_ok = await test_memory_server()

        if server_ok:
            print("\n✓ All tests passed!")
        else:
            print("\n✗ Server test failed")
    else:
        print("\n✗ Storage test failed - skipping server test")

    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())