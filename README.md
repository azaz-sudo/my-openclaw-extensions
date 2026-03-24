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
- CLI commands support (`openclaw mcp list/call/tools/servers`)

## Version Compatibility

| Plugin Version | OpenClaw Version | Branch/Commit | Notes |
|----------------|------------------|---------------|-------|
| v1.1.1 | 2026.3.23+ | `main` (latest) | Fixed plugin entry point compatibility, works with current OpenClaw |
| v1.0.0 | 2026.3.13 | commit `6972815` | Initial version, uses `definePluginEntry` |

### How to choose the right version

**For OpenClaw 2026.3.23 and later:**
```bash
# Use the latest main branch
git clone https://github.com/azaz-sudo/my-openclaw-extensions
cp -r my-openclaw-extensions/mcp-client ~/.openclaw/extensions/
```

**For OpenClaw 2026.3.13:**
```bash
# Use the initial commit
git clone https://github.com/azaz-sudo/my-openclaw-extensions
cd my-openclaw-extensions
git checkout 6972815
cp -r mcp-client ~/.openclaw/extensions/
```

## Installation

```bash
# Clone the repository
git clone https://github.com/azaz-sudo/my-openclaw-extensions

# Copy the plugin to OpenClaw extensions directory
cp -r my-openclaw-extensions/mcp-client ~/.openclaw/extensions/
```

## Configuration

Add the following to your `~/.openclaw/openclaw.json`:

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

See [mcp-client/README.md](./mcp-client/README.md) for detailed documentation.

## License

MIT
