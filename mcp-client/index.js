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

  // Store connected clients (for Gateway runtime)
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

  // Helper function to create a client and connect (for CLI use)
  const createAndConnect = async (serverName) => {
    const serverConfig = servers[serverName];
    if (!serverConfig) {
      return null;
    }

    const client = new McpClient({
      name: serverName,
      config: {
        ...serverConfig,
        timeout: config.timeoutMs,
      },
      logger: console,
    });

    await client.connect();
    return client;
  };

  // Register CLI commands
  api.registerCli(
    ({ program }) => {
      const mcpCmd = program.command("mcp").description("MCP client commands");

      // openclaw mcp list
      mcpCmd
        .command("list")
        .description("List all connected MCP servers and their tools")
        .action(async () => {
          const serverList = [];
          
          for (const name of serverNames) {
            try {
              const client = await createAndConnect(name);
              if (client) {
                serverList.push({
                  name,
                  serverInfo: client.serverInfo,
                  tools: client.getTools().map((t) => t.name),
                  resources: client.getResources().length,
                  prompts: client.getPrompts().length,
                });
                await client.close();
              }
            } catch (err) {
              console.error(`Failed to connect to ${name}: ${err.message}`);
            }
          }

          if (serverList.length === 0) {
            console.log("No MCP servers could be connected.");
            return;
          }

          console.log("\nConnected MCP Servers:\n");
          for (const server of serverList) {
            console.log(`📦 ${server.name}`);
            if (server.serverInfo) {
              console.log(`   Server: ${server.serverInfo.name || "unknown"} v${server.serverInfo.version || "?"}`);
            }
            console.log(`   Tools: ${server.tools.length > 0 ? server.tools.join(", ") : "none"}`);
            console.log(`   Resources: ${server.resources}, Prompts: ${server.prompts}`);
            console.log("");
          }
        });

      // openclaw mcp call <server> <tool> [args]
      mcpCmd
        .command("call <server> <tool>")
        .description("Call a tool on an MCP server")
        .option("-a, --args <json>", "Tool arguments as JSON string", "{}")
        .option("-f, --file <path>", "Read tool arguments from JSON file")
        .action(async (server, tool, options) => {
          // First check if server is configured
          if (!servers[server]) {
            console.error(`Error: MCP server "${server}" not configured.`);
            console.error("\nConfigured servers:", serverNames.join(", ") || "none");
            process.exitCode = 1;
            return;
          }

          let args = {};
          
          if (options.file) {
            try {
              const fs = await import("fs");
              const content = await fs.promises.readFile(options.file, "utf-8");
              args = JSON.parse(content);
            } catch (err) {
              console.error(`Error reading args file: ${err.message}`);
              process.exitCode = 1;
              return;
            }
          } else if (options.args) {
            try {
              args = JSON.parse(options.args);
            } catch (err) {
              console.error(`Error parsing JSON args: ${err.message}`);
              process.exitCode = 1;
              return;
            }
          }

          let client;
          try {
            console.log(`\nConnecting to ${server}...`);
            client = await createAndConnect(server);
            
            if (!client) {
              console.error(`Error: Could not connect to ${server}`);
              process.exitCode = 1;
              return;
            }

            console.log(`Calling ${server}/${tool}...`);
            if (Object.keys(args).length > 0) {
              console.log("Arguments:", JSON.stringify(args, null, 2));
            }
            
            const result = await client.callTool(tool, args);
            
            const content = result.content || [];
            const textParts = content
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n");
            
            if (textParts) {
              console.log("\n" + textParts);
            } else {
              console.log("\nResult:", JSON.stringify(result, null, 2));
            }
          } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exitCode = 1;
          } finally {
            if (client) {
              await client.close();
            }
          }
        });

      // openclaw mcp tools <server>
      mcpCmd
        .command("tools <server>")
        .description("List tools available on an MCP server")
        .action(async (server) => {
          // First check if server is configured
          if (!servers[server]) {
            console.error(`Error: MCP server "${server}" not configured.`);
            console.error("\nConfigured servers:", serverNames.join(", ") || "none");
            process.exitCode = 1;
            return;
          }

          let client;
          try {
            console.log(`\nConnecting to ${server}...`);
            client = await createAndConnect(server);
            
            if (!client) {
              console.error(`Error: Could not connect to ${server}`);
              process.exitCode = 1;
              return;
            }

            const tools = client.getTools();
            
            if (tools.length === 0) {
              console.log(`\nNo tools available on ${server}.`);
              return;
            }

            console.log(`\nTools on ${server}:\n`);
            for (const tool of tools) {
              console.log(`🔧 ${tool.name}`);
              if (tool.description) {
                console.log(`   ${tool.description}`);
              }
              console.log("");
            }
          } catch (err) {
            console.error(`Error: ${err.message}`);
            process.exitCode = 1;
          } finally {
            if (client) {
              await client.close();
            }
          }
        });

      // openclaw mcp servers
      mcpCmd
        .command("servers")
        .description("List configured MCP servers")
        .action(() => {
          const configuredServers = Object.keys(servers);
          
          console.log("\nConfigured MCP Servers:\n");
          for (const name of configuredServers) {
            const serverConfig = servers[name];
            const status = serverConfig.disabled ? "⏸️ disabled" : "✅ enabled";
            console.log(`  ${name}: ${status}`);
            if (serverConfig.url) {
              console.log(`    URL: ${serverConfig.url}`);
            }
            if (serverConfig.command) {
              console.log(`    Command: ${serverConfig.command}`);
            }
          }
          console.log("");
        });
    },
    { commands: ["mcp"] },
  );

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
