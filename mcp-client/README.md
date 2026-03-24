# MCP Client Plugin for OpenClaw

A fully functional MCP (Model Context Protocol) client plugin for OpenClaw that connects to MCP servers and exposes their tools to your AI assistant.

## Features

- ✅ **Multiple Transport Support**: HTTP/SSE, Streamable HTTP, and Stdio transports
- ✅ **Auto-discovery**: Automatically discovers and registers tools from MCP servers
- ✅ **Dynamic Tool Registration**: Each MCP tool becomes a native OpenClaw tool
- ✅ **Management Tools**: `mcp_list` and `mcp_call` for server management
- ✅ **Multiple Servers**: Connect to multiple MCP servers simultaneously

## Installation

### Option 1: Clone to extensions directory

```bash
git clone https://github.com/azaz-sudo/my-openclaw-extensions
cp -r my-openclaw-extensions/mcp-client ~/.openclaw/extensions/
```

### Option 2: Manual installation

Copy the `mcp-client` directory to `~/.openclaw/extensions/mcp-client/`.

## Configuration

Add the following to your `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    allow: ["mcp-client"],
    load: {
      paths: ["~/.openclaw/extensions/mcp-client"],
    },
    entries: {
      "mcp-client": {
        enabled: true,
        config: {
          servers: {
            // HTTP MCP server example (McDonald's)
            "mcd-mcp": {
              url: "https://mcp.mcd.cn",
              headers: {
                "Authorization": "Bearer YOUR_TOKEN",
              },
            },
            // Stdio MCP server example (Filesystem)
            "filesystem": {
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"],
            },
          },
          timeoutMs: 30000, // Optional: default 30000
        },
      },
    },
  },
  // Optional: Allow MCP tools in tool policy
  tools: {
    alsoAllow: ["mcp_list", "mcp_call", "mcp_*"],
  },
}
```

After configuration, restart the gateway:

```bash
openclaw gateway restart
```

## Server Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | string | MCP server URL (for HTTP transport) |
| `command` | string | Command to run (for stdio transport) |
| `args` | string[] | Arguments for stdio transport |
| `env` | object | Environment variables for stdio transport |
| `apiKey` | string | API key for authentication (sets `Authorization: Bearer`) |
| `headers` | object | Additional HTTP headers |
| `disabled` | boolean | Disable this server |

## Usage

### List Connected Servers

```javascript
mcp_list()
```

Returns:
```json
[
  {
    "name": "mcd-mcp",
    "serverInfo": { "name": "mcd-mcp", "version": "1.0.0" },
    "tools": ["available-coupons", "query-meals", "create-order", ...],
    "resources": 0,
    "prompts": 0
  }
]
```

### Call a Tool Dynamically

```javascript
mcp_call({
  server: "mcd-mcp",
  tool: "available-coupons",
  arguments: {}
})
```

### Use MCP Tools Directly

Each MCP tool is registered with the naming convention `mcp_{server_name}_{tool_name}`:

```javascript
// McDonald's coupon query
mcp_mcd_mcp_available_coupons()

// Query meals
mcp_mcd_mcp_query_meals({ category: "breakfast" })
```

## Supported Transports

### HTTP/SSE Transport

For MCP servers with Server-Sent Events:

```json5
{
  "my-server": {
    url: "https://mcp.example.com/sse",
    apiKey: "your-api-key",
  },
}
```

### Streamable HTTP Transport

For modern MCP servers using stateless HTTP:

```json5
{
  "my-server": {
    url: "https://mcp.example.com",
    headers: { "X-API-Key": "your-key" },
  },
}
```

### Stdio Transport

For local MCP server processes:

```json5
{
  "filesystem": {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"],
  },
}
```

## Troubleshooting

### Check plugin status

```bash
openclaw status --deep
```

### View logs

```bash
openclaw logs --follow | grep mcp
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Plugin not loading | Check `plugins.allow` includes `"mcp-client"` |
| Connection timeout | Increase `timeoutMs` in config |
| Tools not available | Add `"mcp_*"` to `tools.alsoAllow` |
| Authentication failed | Verify API key or headers |

## Development

### File Structure

```
mcp-client/
├── openclaw.plugin.json  # Plugin manifest
├── package.json          # NPM package config
├── index.js              # Main plugin entry (function export)
└── src/
    ├── mcp-protocol.js   # MCP protocol types
    ├── mcp-transport.js  # Transport implementations
    └── mcp-client.js     # MCP client class
```

### Key Implementation Notes

1. **Entry Point**: Uses function export instead of `definePluginEntry` for better compatibility
2. **Tool Registration**: Tools are registered with `{ optional: true }` flag
3. **Service Lifecycle**: MCP connections are managed via `registerService`

## Changelog

### v1.1.0 (2026-03-24)

- Fixed: Plugin entry point compatibility issue
- Changed: Use function export instead of `definePluginEntry`
- Improved: Better error handling and logging
- Added: Support for `tools.alsoAllow` with `mcp_*` pattern

### v1.0.0

- Initial release
- Support for HTTP/SSE, Streamable HTTP, and Stdio transports
- Auto-discovery of MCP tools
- Dynamic tool registration

## License

MIT
