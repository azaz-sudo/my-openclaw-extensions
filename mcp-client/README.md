# MCP Client Plugin for OpenClaw

This plugin provides MCP (Model Context Protocol) client support for OpenClaw, allowing you to connect to MCP servers and use their tools.

## Installation

The plugin is installed in `~/.openclaw/extensions/mcp-client/`.

## Configuration

Add the following to your `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      "mcp-client": {
        enabled: true,
        servers: {
          // HTTP/SSE MCP server example
          "tencent-map": {
            url: "https://mcp.map.qq.com/mcp",
            apiKey: "YOUR_TENCENT_MAP_KEY",
          },
          // Stdio MCP server example
          "filesystem": {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"],
          },
          // Another HTTP example
          "custom-server": {
            url: "https://mcp.example.com/sse",
            headers: {
              "X-Custom-Header": "value",
            },
          },
        },
      },
    },
  },
}
```

## Server Configuration Options

Each server can have the following options:

| Option | Type | Description |
|--------|------|-------------|
| `url` | string | MCP server URL (for HTTP/SSE transport) |
| `command` | string | Command to run (for stdio transport) |
| `args` | string[] | Arguments for stdio transport |
| `env` | object | Environment variables for stdio transport |
| `apiKey` | string | API key for authentication |
| `headers` | object | Additional HTTP headers |
| `disabled` | boolean | Disable this server |

## CLI Commands

The plugin registers the following CLI commands under `openclaw mcp`:

### List connected servers

```bash
openclaw mcp list
```

Shows all connected MCP servers, their server info, and available tools.

### List configured servers

```bash
openclaw mcp servers
```

Shows all configured MCP servers and their connection status.

### List tools on a server

```bash
openclaw mcp tools <server>
```

Lists all tools available on the specified MCP server with their descriptions.

### Call a tool

```bash
# Basic call with no arguments
openclaw mcp call <server> <tool>

# Pass arguments as JSON string
openclaw mcp call <server> <tool> --args '{"key": "value"}'

# Read arguments from a JSON file
openclaw mcp call <server> <tool> --file ./args.json
```

Calls a tool on the specified MCP server and prints the result.

### Example

```bash
# List all connected servers
openclaw mcp list

# List tools on mcd-mcp server
openclaw mcp tools mcd-mcp

# Query coupons
openclaw mcp call mcd-mcp query-my-coupons

# Search for restaurants with arguments
openclaw mcp call mcd-mcp search-restaurant --args '{"keyword": "北京"}'
```

## Usage

Once configured and the gateway is restarted, the plugin will:

1. Connect to all configured MCP servers
2. Discover available tools from each server
3. Register each MCP tool as an OpenClaw agent tool

### Available Tools

The plugin registers the following management tools:

- `mcp_list` - List all connected MCP servers and their tools
- `mcp_call` - Call a tool on a specific MCP server

Each MCP server's tools are also registered with the naming convention:
`mcp_{server_name}_{tool_name}`

### Example: Using Tencent Map MCP

After configuring the Tencent Map MCP server:

```
# List available MCP servers
mcp_list

# Call a Tencent Map tool directly
mcp_tencent-map_geocode address="北京市海淀区"

# Or use mcp_call
mcp_call server="tencent-map" tool="geocode" arguments={"address": "北京市海淀区"}
```

## Supported Transports

### HTTP/SSE Transport

For MCP servers that expose an HTTP endpoint with Server-Sent Events:

```json5
{
  servers: {
    "my-server": {
      url: "https://mcp.example.com/sse",
      apiKey: "your-api-key",
    },
  },
}
```

### Stdio Transport

For MCP servers that run as local processes:

```json5
{
  servers: {
    "filesystem": {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"],
    },
  },
}
```

## Troubleshooting

### Check plugin status

```bash
openclaw doctor
```

### View logs

Check the gateway logs for `[mcp-client]` entries:

```bash
# View recent logs
tail -f /tmp/openclaw/openclaw-*.log | grep mcp-client
```

### Common Issues

1. **Connection timeout**: Increase `timeoutMs` in the plugin config
2. **Authentication failed**: Check your API key
3. **Server not found**: Verify the URL or command path

## Development

### File Structure

```
mcp-client/
├── openclaw.plugin.json  # Plugin manifest
├── package.json          # NPM package config
├── index.js              # Main plugin entry
└── src/
    ├── mcp-protocol.js   # MCP protocol types
    ├── mcp-transport.js  # Transport implementations
    └── mcp-client.js     # MCP client class
```

### Building

No build step required - the plugin uses ES modules directly.

## License

MIT
