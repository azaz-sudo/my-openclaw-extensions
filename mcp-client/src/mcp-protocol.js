/**
 * MCP Protocol Types
 * Based on Model Context Protocol specification
 */

// JSON-RPC types
export const JSONRPC_VERSION = "2.0";

/**
 * Create a JSON-RPC request
 */
export function createRequest(id, method, params = null) {
  return {
    jsonrpc: JSONRPC_VERSION,
    id,
    method,
    ...(params !== null && { params }),
  };
}

/**
 * Create a JSON-RPC notification
 */
export function createNotification(method, params = null) {
  return {
    jsonrpc: JSONRPC_VERSION,
    method,
    ...(params !== null && { params }),
  };
}

/**
 * MCP Method names
 */
export const MCP_METHODS = {
  // Lifecycle
  INITIALIZE: "initialize",
  INITIALIZED: "notifications/initialized",
  PING: "ping",
  
  // Resources
  LIST_RESOURCES: "resources/list",
  READ_RESOURCE: "resources/read",
  SUBSCRIBE_RESOURCE: "resources/subscribe",
  UNSUBSCRIBE_RESOURCE: "resources/unsubscribe",
  
  // Prompts
  LIST_PROMPTS: "prompts/list",
  GET_PROMPT: "prompts/get",
  
  // Tools
  LIST_TOOLS: "tools/list",
  CALL_TOOL: "tools/call",
  
  // Logging
  SET_LOG_LEVEL: "logging/setLevel",
};

/**
 * MCP Content Types
 */
export const CONTENT_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  RESOURCE: "resource",
};

/**
 * Create text content
 */
export function createTextContent(text) {
  return {
    type: CONTENT_TYPES.TEXT,
    text,
  };
}

/**
 * Create image content
 */
export function createImageContent(data, mimeType) {
  return {
    type: CONTENT_TYPES.IMAGE,
    data,
    mimeType,
  };
}

/**
 * Create resource content
 */
export function createResourceContent(uri, mimeType, text) {
  return {
    type: CONTENT_TYPES.RESOURCE,
    resource: {
      uri,
      mimeType,
      text,
    },
  };
}

/**
 * Default capabilities for MCP client
 */
export const DEFAULT_CLIENT_CAPABILITIES = {
  experimental: {},
  roots: {
    listChanged: true,
  },
  sampling: {},
};

/**
 * Default client info
 */
export const DEFAULT_CLIENT_INFO = {
  name: "openclaw-mcp-client",
  version: "1.0.0",
};
