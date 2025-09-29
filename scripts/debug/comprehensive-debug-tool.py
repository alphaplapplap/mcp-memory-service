#!/usr/bin/env python3
"""
Comprehensive Debugging Tool for MCP Memory Service

This tool performs systematic diagnostics of the memory service including:
- Environment validation
- Storage backend testing
- Model loading verification
- Connection testing (HTTP/MCP)
- Memory operations testing
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(message)s'
)
logger = logging.getLogger(__name__)

class DebugColors:
    """ANSI color codes for terminal output"""
    CYAN = '\033[36m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    RED = '\033[31m'
    BLUE = '\033[34m'
    BRIGHT = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

class ComprehensiveDebugger:
    """Main debugging orchestrator"""

    def __init__(self):
        self.results = {}
        self.issues = []
        self.fixes = []

    def header(self, text: str):
        """Print a section header"""
        print(f"\n{DebugColors.CYAN}{'=' * 60}{DebugColors.RESET}")
        print(f"{DebugColors.BRIGHT}{text}{DebugColors.RESET}")
        print(f"{DebugColors.CYAN}{'=' * 60}{DebugColors.RESET}\n")

    def success(self, text: str):
        """Print success message"""
        print(f"{DebugColors.GREEN}✓ {text}{DebugColors.RESET}")

    def warning(self, text: str):
        """Print warning message"""
        print(f"{DebugColors.YELLOW}⚠ {text}{DebugColors.RESET}")
        self.issues.append(('warning', text))

    def error(self, text: str):
        """Print error message"""
        print(f"{DebugColors.RED}✗ {text}{DebugColors.RESET}")
        self.issues.append(('error', text))

    def info(self, text: str):
        """Print info message"""
        print(f"{DebugColors.BLUE}ℹ {text}{DebugColors.RESET}")

    def suggest_fix(self, issue: str, fix: str):
        """Record a suggested fix"""
        self.fixes.append({'issue': issue, 'fix': fix})

    # ========================================================================
    # DIAGNOSTIC SECTIONS
    # ========================================================================

    def check_environment(self) -> Dict[str, Any]:
        """Check environment variables and configuration"""
        self.header("Environment Configuration Check")

        env_vars = {
            'MCP_MEMORY_STORAGE_BACKEND': os.getenv('MCP_MEMORY_STORAGE_BACKEND'),
            'HF_HOME': os.getenv('HF_HOME'),
            'TRANSFORMERS_CACHE': os.getenv('TRANSFORMERS_CACHE'),
            'HF_HUB_OFFLINE': os.getenv('HF_HUB_OFFLINE'),
            'TRANSFORMERS_OFFLINE': os.getenv('TRANSFORMERS_OFFLINE'),
            'MCP_API_KEY': os.getenv('MCP_API_KEY', '***'),
            'MCP_SERVER_PORT': os.getenv('MCP_SERVER_PORT'),
        }

        for key, value in env_vars.items():
            if value:
                self.success(f"{key}: {value}")
            else:
                self.warning(f"{key}: Not set")

        # Check .env file
        env_file = Path.cwd() / '.env'
        if env_file.exists():
            self.success(f".env file found at: {env_file}")
        else:
            self.error(".env file not found")
            self.suggest_fix(
                "Missing .env file",
                "Create .env file with required configuration"
            )

        return env_vars

    def check_python_environment(self):
        """Check Python packages and versions"""
        self.header("Python Environment Check")

        self.info(f"Python version: {sys.version}")
        self.info(f"Python executable: {sys.executable}")

        # Check required packages
        packages = [
            'chromadb',
            'sentence_transformers',
            'torch',
            'transformers',
            'fastmcp',
            'mcp',
        ]

        for package in packages:
            try:
                mod = __import__(package)
                version = getattr(mod, '__version__', 'unknown')
                self.success(f"{package}: {version}")
            except ImportError as e:
                self.error(f"{package}: Not installed - {e}")
                self.suggest_fix(
                    f"Missing package: {package}",
                    f"Run: uv pip install {package}"
                )

    def check_huggingface_cache(self):
        """Check HuggingFace model cache"""
        self.header("HuggingFace Model Cache Check")

        hf_home = os.getenv('HF_HOME', os.path.expanduser('~/.cache/huggingface'))
        cache_dir = Path(hf_home) / 'hub'

        if not cache_dir.exists():
            self.error(f"Cache directory not found: {cache_dir}")
            return

        self.success(f"Cache directory exists: {cache_dir}")

        # Check for sentence-transformer models
        models = [
            'all-MiniLM-L6-v2',
            'all-mpnet-base-v2',
            'paraphrase-MiniLM-L6-v2',
        ]

        found_models = []
        for model in models:
            model_dir = cache_dir / f"models--sentence-transformers--{model}"
            if model_dir.exists():
                self.success(f"Found model: {model}")

                # Check snapshots
                snapshots_dir = model_dir / 'snapshots'
                if snapshots_dir.exists():
                    snapshots = list(snapshots_dir.iterdir())
                    if snapshots:
                        snapshot = snapshots[0]
                        self.info(f"  Snapshot: {snapshot.name}")

                        # Check for required files
                        required_files = ['config.json', 'model.safetensors', 'tokenizer.json']
                        for file in required_files:
                            file_path = snapshot / file
                            if file_path.exists():
                                self.info(f"    ✓ {file}")
                            else:
                                self.warning(f"    ✗ {file} missing")

                        found_models.append({
                            'name': model,
                            'path': str(model_dir),
                            'snapshot': snapshot.name
                        })
            else:
                self.warning(f"Model not found: {model}")

        if not found_models:
            self.error("No sentence-transformer models found in cache")
            self.suggest_fix(
                "Missing models in cache",
                "Download models using: from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"
            )

        return found_models

    def check_storage_backend(self):
        """Check storage backend configuration"""
        self.header("Storage Backend Check")

        backend = os.getenv('MCP_MEMORY_STORAGE_BACKEND', 'sqlite_vec')
        self.info(f"Configured backend: {backend}")

        try:
            from mcp_memory_service.config import STORAGE_BACKEND, SUPPORTED_BACKENDS
            self.success(f"Loaded backend from config: {STORAGE_BACKEND}")
            self.info(f"Supported backends: {', '.join(SUPPORTED_BACKENDS)}")

            if STORAGE_BACKEND not in SUPPORTED_BACKENDS:
                self.error(f"Invalid backend: {STORAGE_BACKEND}")
                self.suggest_fix(
                    f"Invalid backend '{STORAGE_BACKEND}'",
                    f"Set MCP_MEMORY_STORAGE_BACKEND to one of: {', '.join(SUPPORTED_BACKENDS)}"
                )
        except Exception as e:
            self.error(f"Failed to load config: {e}")

    def test_model_loading(self):
        """Test sentence-transformer model loading"""
        self.header("Model Loading Test")

        try:
            from sentence_transformers import SentenceTransformer

            models_to_test = [
                'sentence-transformers/all-MiniLM-L6-v2',
                'all-MiniLM-L6-v2',
            ]

            for model_name in models_to_test:
                self.info(f"\nTesting: {model_name}")
                try:
                    # Try to load in offline mode
                    os.environ['HF_HUB_OFFLINE'] = '1'
                    os.environ['TRANSFORMERS_OFFLINE'] = '1'

                    model = SentenceTransformer(model_name, device='cpu')
                    self.success(f"Loaded successfully: {model_name}")

                    # Test encoding
                    embedding = model.encode("test sentence")
                    self.success(f"  Encoding works, dimension: {len(embedding)}")

                    return True

                except Exception as e:
                    self.warning(f"Failed to load {model_name}: {str(e)[:100]}")

            self.error("All model loading attempts failed")
            return False

        except ImportError:
            self.error("sentence-transformers not installed")
            return False

    def test_chromadb_initialization(self):
        """Test ChromaDB initialization"""
        self.header("ChromaDB Initialization Test")

        try:
            from mcp_memory_service.storage.chroma import ChromaMemoryStorage
            import tempfile

            with tempfile.TemporaryDirectory() as tmpdir:
                self.info(f"Testing ChromaDB in: {tmpdir}")

                try:
                    storage = ChromaMemoryStorage(path=tmpdir, preload_model=True)
                    self.success("ChromaDB initialized successfully")

                    if storage.embedding_function:
                        self.success("Embedding function created")
                    else:
                        self.warning("Embedding function is None")

                    return True

                except Exception as e:
                    self.error(f"ChromaDB initialization failed: {e}")
                    import traceback
                    self.info(f"\n{traceback.format_exc()}")
                    return False

        except ImportError as e:
            self.error(f"Failed to import ChromaMemoryStorage: {e}")
            return False

    def test_http_server(self):
        """Test HTTP server availability"""
        self.header("HTTP Server Connection Test")

        import urllib.request
        import ssl

        port = os.getenv('MCP_SERVER_PORT', '8443')
        url = f"https://localhost:{port}/api/health"

        try:
            # Create SSL context that doesn't verify certificates
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            req = urllib.request.Request(url)
            req.add_header('Authorization', f"Bearer {os.getenv('MCP_API_KEY', 'test-key-123')}")

            with urllib.request.urlopen(req, context=ctx, timeout=3) as response:
                data = response.read()
                self.success(f"HTTP server responding on port {port}")
                self.info(f"Response: {data.decode()[:100]}")
                return True

        except Exception as e:
            self.warning(f"HTTP server not available: {e}")
            self.suggest_fix(
                "HTTP server not running",
                "Start the server with: uv run memory server"
            )
            return False

    def generate_summary(self):
        """Generate summary report"""
        self.header("Debug Summary")

        if not self.issues:
            self.success("No issues found! System appears healthy.")
        else:
            self.warning(f"Found {len(self.issues)} issues:")
            for severity, message in self.issues:
                icon = "⚠" if severity == 'warning' else "✗"
                color = DebugColors.YELLOW if severity == 'warning' else DebugColors.RED
                print(f"  {color}{icon} {message}{DebugColors.RESET}")

        if self.fixes:
            self.header("Suggested Fixes")
            for i, fix in enumerate(self.fixes, 1):
                print(f"\n{DebugColors.BRIGHT}{i}. {fix['issue']}{DebugColors.RESET}")
                print(f"   {DebugColors.GREEN}→ {fix['fix']}{DebugColors.RESET}")

    def run_all(self):
        """Run all diagnostic checks"""
        print(f"\n{DebugColors.BRIGHT}{DebugColors.CYAN}")
        print("╔═══════════════════════════════════════════════════════════╗")
        print("║     MCP Memory Service - Comprehensive Debug Tool         ║")
        print("╚═══════════════════════════════════════════════════════════╝")
        print(DebugColors.RESET)

        # Run all checks
        self.check_environment()
        self.check_python_environment()
        self.check_huggingface_cache()
        self.check_storage_backend()
        self.test_model_loading()
        self.test_chromadb_initialization()
        self.test_http_server()

        # Generate summary
        self.generate_summary()

        print(f"\n{DebugColors.CYAN}{'=' * 60}{DebugColors.RESET}\n")

if __name__ == '__main__':
    debugger = ComprehensiveDebugger()
    debugger.run_all()