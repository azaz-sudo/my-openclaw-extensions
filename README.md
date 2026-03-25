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

OpenClaw supports two ways to configure MCP servers. **Do not configure the same server in both places** — this will cause the plugin to initialize multiple times and produce duplicate connection logs.

### Recommended: Top-level `mcp.servers` (Preferred)

Configure MCP servers at the top level of your `~/.openclaw/openclaw.json`:

```json5
{
  mcp: {
    servers: {
      "my-mcp-server": {
        url: "https://mcp.example.com",
        apiKey: "YOUR_API_KEY", // or use headers for custom auth
      },
    },
  },
  plugins: {
    allow: ["mcp-client"],
    entries: {
      "mcp-client": {
        enabled: true,
        // No config.servers here — use top-level mcp.servers instead
      },
    },
  },
}
```

### Alternative: Plugin-level `config.servers` (Legacy)

You can also configure servers directly in the plugin config, but this is not recommended for new setups:

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

### ⚠️ Avoid Duplicate Configuration

If the same server appears in both `mcp.servers` and `plugins.entries.mcp-client.config.servers`, OpenClaw will initialize it twice, resulting in duplicate connection logs like:

```
[plugins] [mcp:mcd-mcp] Connected to mcd-mcp v1.0.0
[plugins] [mcp:mcd-mcp] Connected to mcd-mcp v1.0.0
[gateway] [mcp:mcd-mcp] Initialized with 18 tools
...
```

**Solution:** Keep your MCP server config in one place only — prefer `mcp.servers` at the top level.

After configuration, restart the gateway:
```bash
openclaw gateway restart
```

See [mcp-client/README.md](./mcp-client/README.md) for detailed documentation.

## License

MIT
