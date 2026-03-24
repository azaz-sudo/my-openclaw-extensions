# My OpenClaw Extensions

A collection of custom plugins for [OpenClaw](https://github.com/openclaw/openclaw).

## Plugins

### mcp-client

A fully functional MCP (Model Context Protocol) client plugin that connects to MCP servers and exposes their tools to your AI assistant.

**Features:**
- Multiple transport support (HTTP/SSE, Streamable HTTP, Stdio)
- Auto-discovery of MCP tools
- Dynamic tool registration
- Multiple server support

**Installation:**
```bash
cp -r mcp-client ~/.openclaw/extensions/
```

**Configuration:**
```json5
{
  plugins: {
    allow: ["mcp-client"],
    entries: {
      "mcp-client": {
        enabled: true,
        config: {
          servers: {
            "my-mcp-server": {
              url: "https://mcp.example.com",
              headers: { "Authorization": "Bearer YOUR_TOKEN" },
            },
          },
        },
      },
    },
  },
}
```

See [mcp-client/README.md](./mcp-client/README.md) for detailed documentation.

## License

MIT
