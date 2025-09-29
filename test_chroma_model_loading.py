#!/usr/bin/env python
"""Test script to diagnose ChromaDB model loading issues."""

import sys
import os
import logging
import traceback

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Set environment variables before imports
os.environ['MCP_MEMORY_STORAGE_BACKEND'] = 'chroma'
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TRANSFORMERS_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

def test_sentence_transformers():
    """Test if sentence_transformers can be imported."""
    print("\n=== Testing sentence_transformers import ===")
    try:
        import sentence_transformers
        print(f"✓ sentence_transformers version: {sentence_transformers.__version__}")
        return True
    except ImportError as e:
        print(f"✗ Failed to import sentence_transformers: {e}")
        return False

def test_chromadb():
    """Test if chromadb can be imported."""
    print("\n=== Testing chromadb import ===")
    try:
        import chromadb
        print(f"✓ chromadb version: {chromadb.__version__}")
        return True
    except ImportError as e:
        print(f"✗ Failed to import chromadb: {e}")
        return False

def test_model_loading():
    """Test loading sentence transformer models."""
    print("\n=== Testing model loading ===")

    try:
        from sentence_transformers import SentenceTransformer

        models_to_test = [
            'all-MiniLM-L6-v2',
            'all-mpnet-base-v2',
            'paraphrase-MiniLM-L6-v2'
        ]

        for model_name in models_to_test:
            print(f"\nTesting model: {model_name}")
            try:
                # Check cache
                hf_home = os.environ.get('HF_HOME', os.path.expanduser("~/.cache/huggingface"))
                model_cache_path = os.path.join(hf_home, "hub", f"models--sentence-transformers--{model_name.replace('/', '--')}")

                if os.path.exists(model_cache_path):
                    print(f"  ✓ Model cache found at: {model_cache_path}")
                    local_files_only = True
                else:
                    print(f"  ⚠ Model cache NOT found at: {model_cache_path}")
                    local_files_only = False

                # Try loading the model
                print(f"  Loading with local_files_only={local_files_only}...")
                model = SentenceTransformer(model_name, device='cpu', local_files_only=local_files_only)

                # Test encoding
                test_embedding = model.encode("Test sentence", show_progress_bar=False)
                print(f"  ✓ Model loaded successfully")
                print(f"  ✓ Embedding shape: {test_embedding.shape}")

            except Exception as e:
                print(f"  ✗ Failed to load model: {e}")
                logger.debug(traceback.format_exc())

    except ImportError as e:
        print(f"✗ Cannot test model loading - sentence_transformers not available: {e}")

def test_chroma_storage_init():
    """Test ChromaDB storage initialization."""
    print("\n=== Testing ChromaDB storage initialization ===")

    try:
        # Import the ChromaDB storage class
        from src.mcp_memory_service.storage.chroma import ChromaMemoryStorage

        # Try to initialize
        print("Initializing ChromaMemoryStorage...")
        storage_path = os.path.expanduser("~/.mcp-memory-service/chroma_test")
        os.makedirs(storage_path, exist_ok=True)

        storage = ChromaMemoryStorage(path=storage_path, preload_model=True)

        # Check initialization status
        status = storage.get_initialization_status()
        print("\nInitialization status:")
        for key, value in status.items():
            print(f"  {key}: {value}")

        if storage.is_initialized():
            print("\n✓ ChromaDB storage initialized successfully!")
        else:
            print("\n✗ ChromaDB storage initialization incomplete")

    except Exception as e:
        print(f"\n✗ Failed to initialize ChromaDB storage: {e}")
        logger.error(traceback.format_exc())

def test_embedding_function():
    """Test the embedding function directly."""
    print("\n=== Testing embedding function ===")

    try:
        from chromadb.utils import embedding_functions

        print("Testing DefaultEmbeddingFunction...")
        try:
            ef = embedding_functions.DefaultEmbeddingFunction()
            test_embedding = ef(["Test sentence"])
            print(f"✓ DefaultEmbeddingFunction works")
            print(f"  Embedding length: {len(test_embedding[0]) if test_embedding else 'N/A'}")
        except Exception as e:
            print(f"✗ DefaultEmbeddingFunction failed: {e}")

    except ImportError as e:
        print(f"✗ Cannot test embedding functions: {e}")

def check_environment():
    """Check environment setup."""
    print("\n=== Environment Check ===")
    print(f"Python version: {sys.version}")
    print(f"Platform: {sys.platform}")

    important_vars = [
        'MCP_MEMORY_STORAGE_BACKEND',
        'HF_HUB_OFFLINE',
        'TRANSFORMERS_OFFLINE',
        'HF_HOME',
        'TRANSFORMERS_CACHE'
    ]

    print("\nEnvironment variables:")
    for var in important_vars:
        value = os.environ.get(var, 'NOT SET')
        print(f"  {var}: {value}")

    # Check cache directories
    print("\nCache directories:")
    hf_home = os.environ.get('HF_HOME', os.path.expanduser("~/.cache/huggingface"))
    print(f"  HuggingFace home: {hf_home}")
    print(f"  Exists: {os.path.exists(hf_home)}")

    if os.path.exists(hf_home):
        hub_path = os.path.join(hf_home, "hub")
        if os.path.exists(hub_path):
            print(f"\n  Models in cache:")
            for item in os.listdir(hub_path):
                if item.startswith("models--"):
                    print(f"    - {item}")

def main():
    """Run all tests."""
    print("=" * 60)
    print("ChromaDB Model Loading Diagnostic Tool")
    print("=" * 60)

    check_environment()

    has_st = test_sentence_transformers()
    has_chroma = test_chromadb()

    if has_st:
        test_model_loading()

    if has_chroma:
        test_embedding_function()

    if has_st and has_chroma:
        test_chroma_storage_init()

    print("\n" + "=" * 60)
    print("Diagnostic complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()