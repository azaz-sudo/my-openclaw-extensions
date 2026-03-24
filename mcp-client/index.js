/**
 * MCP Client Plugin for OpenClaw
 * 
 * This plugin provides MCP (Model Context Protocol) client support,
 * allowing OpenClaw to connect to MCP servers and use their tools.
 */

import { McpClient } from "./src/mcp-client.js";

// Plugin metadata
export const id = "mcp-client";
export const name = "MCP Client";
export const description = "Model Context Protocol client for connecting to MCP servers";

// Default export - plugin entry
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

  // Register mcp_list tool (always available)
  api.registerTool({
    name: "mcp_list",
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

  // Register mcp_call tool for dynamic tool calls
  api.registerTool(
    {
      name: "mcp_call",
      description: "Call a tool on an MCP server dynamically",
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
    },
    { optional: true }
  );

  // Register service for lifecycle management and tool discovery
  api.registerService({
    id: "mcp-client",
    start: async () => {
      // Connect to all configured MCP servers
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

          // Register tools from this MCP server as individual tools
          const tools = client.getTools();
          for (const tool of tools) {
            registerMcpTool(api, name, client, tool);
          }

          api.logger.info(`[mcp-client] Connected to ${name} with ${tools.length} tools`);
        } catch (err) {
          api.logger.error(`[mcp-client] Failed to connect to ${name}:`, err.message);
        }
      }
    },
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

  /**
   * Register an MCP tool as an OpenClaw agent tool
   */
  function registerMcpTool(api, serverName, client, tool) {
    const toolName = `mcp_${serverName.replace(/-/g, "_")}_${tool.name}`;

    api.registerTool(
      {
        name: toolName,
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
      },
      { optional: true }
    );
  }

  api.logger.info(`[mcp-client] Plugin loaded with ${serverNames.length} server(s) configured`);
}
