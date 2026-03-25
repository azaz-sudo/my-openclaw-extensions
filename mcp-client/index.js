/**
 * MCP Client Plugin for OpenClaw
 * 
 * This plugin provides MCP (Model Context Protocol) client support,
 * allowing OpenClaw to connect to MCP servers and use their tools.
 * 
 * Configuration: Uses plugins.entries.mcp-client.config.servers from openclaw.json
 */

import { McpClient } from "./src/mcp-client.js";

// Plugin metadata
export const id = "mcp-client";
export const name = "MCP Client";
export const description = "Model Context Protocol client for connecting to MCP servers";

// Default export - plugin entry
export default function mcpClientPlugin(api) {
  // api.pluginConfig is the content of plugins.entries.mcp-client.config
  // So if config is { servers: { ... } }, pluginConfig IS { servers: { ... } }
  const pluginConfig = api.pluginConfig || {};
  
  // Read servers directly from pluginConfig
  const servers = pluginConfig.servers || {};
  const serverNames = Object.keys(servers).filter(
    (name) => !servers[name].disabled
  );

  const config = {
    enabled: true, // enabled is controlled by plugins.entries.mcp-client.enabled, not passed here
    timeoutMs: typeof pluginConfig.timeoutMs === "number" ? pluginConfig.timeoutMs : 30000,
  };

  if (!config.enabled) {
    api.logger.info("[mcp-client] Plugin disabled");
    return;
  }

  if (serverNames.length === 0) {
    api.logger.info("[mcp-client] No MCP servers configured in plugins.entries.mcp-client.config.servers");
    return;
  }

  // Store connected clients (for Gateway runtime)
  const clients = new Map();

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

  // Register CLI commands (use 'mcp-client' to avoid conflict with built-in 'mcp' command)
  api.registerCli(
    ({ program }) => {
      const mcpCmd = program.command("mcp-client").description("MCP client commands - connect and call MCP tools");

      // openclaw mcp-client list
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

      // openclaw mcp-client call <server> <tool> [args]
      mcpCmd
        .command("call <server> <tool>")
        .description("Call a tool on an MCP server")
        .option("-a, --args <json>", "Tool arguments as JSON string", "{}")
        .option("-f, --file <path>", "Read tool arguments from JSON file")
        .action(async (server, tool, options) => {
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

      // openclaw mcp-client tools <server>
      mcpCmd
        .command("tools <server>")
        .description("List tools available on an MCP server")
        .action(async (server) => {
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

      // openclaw mcp-client servers
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
    { commands: ["mcp-client"] },
  );

  // Connect to MCP servers immediately (don't rely on registerService lifecycle)
  const connectToServers = async () => {
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
  };

  // Start connection immediately
  connectToServers().catch((err) => {
    api.logger.error("[mcp-client] Connection error:", err.message);
  });

  // Also register service for lifecycle management (stop handler)
  api.registerService({
    id: "mcp-client",
    start: async () => {
      // Already connected above, just log
      api.logger.info(`[mcp-client] Service started, ${clients.size} server(s) connected`);
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
