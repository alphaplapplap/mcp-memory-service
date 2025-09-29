# Development Tools and Utilities

This directory contains development tools, build utilities, and deployment configurations for MCP Memory Service.

## Directory Structure

### `/build/` - Build Tools
- `setup.py` - Python package build configuration
- Build scripts and packaging utilities

### `/deployments/` - Deployment Tools
- `cloudflare/` - Cloudflare Workers deployment configuration
- Cloud platform deployment scripts and configurations


## Usage

### Build Tools
```bash
# Build Python package
cd tools/build
python setup.py sdist bdist_wheel
```

### Cloudflare Workers
```bash
# Deploy to Cloudflare Workers
cd tools/deployments/cloudflare
npm install
wrangler deploy
```

## Related Documentation

- [Installation Guide](../docs/installation/master-guide.md) - General installation
- [Development Guide](../docs/technical/development.md) - Development setup