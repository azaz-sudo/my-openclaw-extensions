/**
 * MCP Client Plugin for OpenClaw
 * 
 * This plugin provides MCP (Model Context Protocol) client support,
 * allowing OpenClaw to connect to MCP servers and use their tools.
 */

import { McpClient } from "./src/mcp-client.js";

/**
 * Plugin entry point - export as function
 */
export default function mcpClientPlugin(api) {
  const pluginConfig = api.pluginConfig || {};
  const config = {
    enabled: typeof pluginConfig.enabled === "boolean" ? pluginConfig.enabled : true,
    servers: pluginConfig.servers || {},
    timeoutMs: typeof pluginConfig.timeoutMs === "number" ? pluginConfig.timeoutMs : 30000,
  };
  
  if (!config.enabled) {
    api.logger.info("[mcp-client] Plugin disabled");
    return;
  }

  const servers = config.servers || {};
  const serverNames = Object.keys(servers).filter(
    (name) => !servers[name].disabled
  );

  if (serverNames.length === 0) {
    api.logger.info("[mcp-client] No MCP servers configured");
    return;
  }

  // Store connected clients
  const clients = new Map();

  /**
   * Connect to all configured MCP servers
   */
  const connectAll = async () => {
    for (const name of serverNames) {
      const serverConfig = servers[name];
      
      try {
        const client = new McpClient({
          name,
          config: {
            ...serverConfig,
            timeout: config.timeoutMs,
          },
          logger: api.logger,
        });

        await client.connect();
        clients.set(name, client);

        // Register tools from this MCP server
        const tools = client.getTools();
        for (const tool of tools) {
          registerMcpTool(name, client, tool);
        }
        
        api.logger.info(`[mcp-client] Connected to ${name} with ${tools.length} tools`);
      } catch (err) {
        api.logger.error(`[mcp-client] Failed to connect to ${name}:`, err.message);
      }
    }
  };

  /**
   * Register an MCP tool as an OpenClaw agent tool
   */
  const registerMcpTool = (serverName, client, tool) => {
    const toolName = `mcp_${serverName.replace(/-/g, "_")}_${tool.name}`;
    
    api.registerTool({
      name: toolName,
      label: `MCP: ${serverName}/${tool.name}`,
      description: tool.description || `MCP tool from ${serverName}`,
      parameters: tool.inputSchema || {
        type: "object",
        properties: {},
      },
      async execute(_toolCallId, params) {
        try {
          const result = await client.callTool(tool.name, params || {});
          
          // Format result for OpenClaw
          const content = result.content || [];
          const textParts = content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
          
          return {
            content: [{ type: "text", text: textParts || JSON.stringify(result, null, 2) }],
            details: result,
          };
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${err.message}` }],
            isError: true,
          };
        }
      },
    }, { optional: true });
  };

  // Register a management tool
  api.registerTool({
    name: "mcp_list",
    label: "MCP: List Servers",
    description: "List all connected MCP servers and their tools",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute() {
      const serverList = [];
      
      for (const [name, client] of clients) {
        serverList.push({
          name,
          serverInfo: client.serverInfo,
          tools: client.getTools().map((t) => t.name),
          resources: client.getResources().length,
          prompts: client.getPrompts().length,
        });
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(serverList, null, 2),
        }],
        details: { servers: serverList },
      };
    },
  });

  // Register tool to call any MCP tool dynamically
  api.registerTool({
    name: "mcp_call",
    label: "MCP: Call Tool",
    description: "Call a tool on an MCP server",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "MCP server name",
        },
        tool: {
          type: "string",
          description: "Tool name on the MCP server",
        },
        arguments: {
          type: "object",
          description: "Tool arguments",
        },
      },
      required: ["server", "tool"],
    },
    async execute(_toolCallId, params) {
      const { server, tool, arguments: args } = params;
      const client = clients.get(server);
      
      if (!client) {
        return {
          content: [{ type: "text", text: `Error: MCP server "${server}" not connected` }],
          isError: true,
        };
      }

      try {
        const result = await client.callTool(tool, args || {});
        
        const content = result.content || [];
        const textParts = content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join("\n");
        
        return {
          content: [{ type: "text", text: textParts || JSON.stringify(result, null, 2) }],
          details: result,
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    },
  }, { optional: true });

  // Register service for lifecycle management
  api.registerService({
    id: "mcp-client",
    start: connectAll,
    stop: async () => {
      for (const [name, client] of clients) {
        try {
          await client.close();
        } catch (err) {
          api.logger.error(`[mcp-client] Error closing ${name}:`, err.message);
        }
      }
      clients.clear();
    },
  });

  api.logger.info(`[mcp-client] Plugin loaded with ${serverNames.length} server(s) configured`);
}
