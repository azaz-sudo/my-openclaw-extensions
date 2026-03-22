# My OpenClaw Extensions

个人收集和修改的 OpenClaw 扩展插件。

## 插件列表

### mcp-client

MCP (Model Context Protocol) 客户端插件，用于连接 MCP 服务器。

**功能特性：**
- 支持 **Streamable HTTP** 传输协议（MCP 2024-11-05 规范）
- 支持 **SSE (Server-Sent Events)** 传输协议
- 支持 **stdio** 传输协议
- 自动发现并注册 MCP 工具

**安装：**

将 `mcp-client` 文件夹复制到 OpenClaw 的 extensions 目录：
- Windows: `C:\Users\<用户名>\.openclaw\extensions\`
- macOS/Linux: `~/.openclaw/extensions/`

**配置示例 (openclaw.json)：**

```json
{
  "plugins": {
    "allow": ["mcp-client"],
    "load": {
      "paths": ["~/.openclaw/extensions/mcp-client"]
    },
    "entries": {
      "mcp-client": {
        "enabled": true,
        "config": {
          "servers": {
            "my-mcp-server": {
              "type": "streamablehttp",
              "url": "https://mcp.example.com",
              "headers": {
                "Authorization": "Bearer YOUR_TOKEN"
              }
            }
          }
        }
      }
    }
  }
}
```

**传输类型：**
- `streamablehttp` - Streamable HTTP（推荐，现代 MCP 服务器默认）
- `sse` - Server-Sent Events
- `stdio` - 本地进程通信

## License

MIT
