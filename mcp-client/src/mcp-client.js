/**
 * MCP Client - Main client class for connecting to MCP servers
 */

import { createTransport } from "./mcp-transport.js";
import {
  MCP_METHODS,
  DEFAULT_CLIENT_CAPABILITIES,
  DEFAULT_CLIENT_INFO,
} from "./mcp-protocol.js";

/**
 * MCP Client
 */
export class McpClient {
  constructor(options) {
    this.name = options.name;
    this.config = options.config;
    this.logger = options.logger || console;
    this.transport = null;
    this.serverInfo = null;
    this.capabilities = null;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
    this.initialized = false;
  }

  /**
   * Connect to MCP server
   */
  async connect() {
    this.logger.info(`[mcp:${this.name}] Connecting to MCP server...`);
    
    this.transport = createTransport({
      ...this.config,
      timeout: this.config.timeout || 30000,
    });

    // Set up error handler
    this.transport.on("error", (error) => {
      this.logger.error(`[mcp:${this.name}] Transport error:`, error);
    });

    // Connect transport
    await this.transport.connect();
    this.logger.info(`[mcp:${this.name}] Transport connected`);

    // Initialize MCP session
    await this.initialize();
    
    // Fetch available tools, resources, prompts
    await this.discoverCapabilities();
    
    this.initialized = true;
    this.logger.info(`[mcp:${this.name}] Initialized with ${this.tools.length} tools`);
  }

  /**
   * Initialize MCP session
   */
  async initialize() {
    const result = await this.transport.request(MCP_METHODS.INITIALIZE, {
      protocolVersion: "2024-11-05",
      capabilities: DEFAULT_CLIENT_CAPABILITIES,
      clientInfo: DEFAULT_CLIENT_INFO,
    });

    this.serverInfo = result.serverInfo;
    this.capabilities = result.capabilities;
    
    this.logger.info(`[mcp:${this.name}] Connected to ${this.serverInfo?.name || "unknown"} v${this.serverInfo?.version || "?"}`);

    // Send initialized notification
    this.transport.notify(MCP_METHODS.INITIALIZED);
  }

  /**
   * Discover server capabilities (tools, resources, prompts)
   */
  async discoverCapabilities() {
    // Fetch tools
    if (this.capabilities?.tools) {
      try {
        const result = await this.transport.request(MCP_METHODS.LIST_TOOLS);
        this.tools = result.tools || [];
      } catch (err) {
        this.logger.warn(`[mcp:${this.name}] Failed to list tools:`, err.message);
      }
    }

    // Fetch resources
    if (this.capabilities?.resources) {
      try {
        const result = await this.transport.request(MCP_METHODS.LIST_RESOURCES);
        this.resources = result.resources || [];
      } catch (err) {
        this.logger.warn(`[mcp:${this.name}] Failed to list resources:`, err.message);
      }
    }

    // Fetch prompts
    if (this.capabilities?.prompts) {
      try {
        const result = await this.transport.request(MCP_METHODS.LIST_PROMPTS);
        this.prompts = result.prompts || [];
      } catch (err) {
        this.logger.warn(`[mcp:${this.name}] Failed to list prompts:`, err.message);
      }
    }
  }

  /**
   * Call a tool
   */
  async callTool(toolName, args = {}) {
    if (!this.initialized) {
      throw new Error("Client not initialized");
    }

    this.logger.debug(`[mcp:${this.name}] Calling tool: ${toolName}`);
    
    const result = await this.transport.request(MCP_METHODS.CALL_TOOL, {
      name: toolName,
      arguments: args,
    });

    return result;
  }

  /**
   * Read a resource
   */
  async readResource(uri) {
    if (!this.initialized) {
      throw new Error("Client not initialized");
    }

    const result = await this.transport.request(MCP_METHODS.READ_RESOURCE, {
      uri,
    });

    return result;
  }

  /**
   * Get a prompt
   */
  async getPrompt(promptName, args = {}) {
    if (!this.initialized) {
      throw new Error("Client not initialized");
    }

    const result = await this.transport.request(MCP_METHODS.GET_PROMPT, {
      name: promptName,
      arguments: args,
    });

    return result;
  }

  /**
   * Ping server
   */
  async ping() {
    await this.transport.request(MCP_METHODS.PING);
  }

  /**
   * Get available tools
   */
  getTools() {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * Get available resources
   */
  getResources() {
    return this.resources;
  }

  /**
   * Get available prompts
   */
  getPrompts() {
    return this.prompts;
  }

  /**
   * Close connection
   */
  async close() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.initialized = false;
    this.logger.info(`[mcp:${this.name}] Disconnected`);
  }
}
