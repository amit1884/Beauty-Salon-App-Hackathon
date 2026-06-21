#!/usr/bin/env bash
# Run SalonBook MCP server standalone (stdio transport for external MCP clients)
set -euo pipefail
cd "$(dirname "$0")/../backend"
source .venv/bin/activate
exec fastmcp run app.mcp.server:mcp --transport stdio
