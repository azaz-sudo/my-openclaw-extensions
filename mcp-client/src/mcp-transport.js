/**
 * MCP Transport implementations
 * Supports Streamable HTTP, HTTP/SSE, and stdio transports
 */

import { spawn } from "child_process";
import { createRequest, createNotification, MCP_METHODS } from "./mcp-protocol.js";

/**
 * Base transport class
 */
export class BaseTransport {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.eventHandlers = new Map();
  }

  /**
   * Generate next request ID
   */
  nextId() {
    return ++this.requestId;
  }

  /**
   * Send a request and wait for response
   */
  async request(method, params = null) {
    const id = this.nextId();
    const request = createRequest(id, method, params);
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });
      this.send(request);
    });
  }

  /**
   * Send a notification (no response expected)
   */
  notify(method, params = null) {
    const notification = createNotification(method, params);
    this.send(notification);
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      // Response to a request
      if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeoutId);
          this.pendingRequests.delete(message.id);
          
          if (message.error) {
            pending.reject(new Error(message.error.message || "Unknown error"));
          } else {
            pending.resolve(message.result);
          }
        }
      }
      
      // Notification from server
      if (message.method) {
        this.emit(message.method, message.params);
      }
    } catch (err) {
      console.error("Failed to parse message:", err);
    }
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  /**
   * Emit event
   */
  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        handler(data);
      }
    }
  }

  /**
   * Close transport
   */
  async close() {
    // Override in subclass
  }

  /**
   * Send data - override in subclass
   */
  send(data) {
    throw new Error("send() must be implemented by subclass");
  }
}

/**
 * HTTP/SSE Transport
 */
export class HttpSseTransport extends BaseTransport {
  constructor(options) {
    super(options);
    this.url = options.url;
    this.headers = options.headers || {};
    this.apiKey = options.apiKey;
    this.eventSource = null;
    this.messageEndpoint = null;
    this.sessionId = null;
    this.connected = false;
  }

  /**
   * Connect to MCP server
   */
  async connect() {
    const headers = {
      ...this.headers,
    };
    
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    // First, try to get the SSE endpoint
    const sseUrl = this.url.includes("/sse") ? this.url : `${this.url}/sse`;
    
    return new Promise((resolve, reject) => {
      try {
        // Dynamic import for EventSource
        import("eventsource").then(({ default: EventSource }) => {
          this.eventSource = new EventSource(sseUrl, {
            headers,
          });

          this.eventSource.onopen = () => {
            this.connected = true;
          };

          this.eventSource.onmessage = (event) => {
            this.handleSseMessage(event);
          };

          this.eventSource.onerror = (error) => {
            if (!this.connected) {
              reject(new Error(`Failed to connect to MCP server: ${error.message || "Unknown error"}`));
            } else {
              this.emit("error", error);
            }
          };

          // Wait for endpoint event
          this.on("endpoint", (data) => {
            this.messageEndpoint = data;
            this.connected = true;
            resolve();
          });

          // Timeout for connection
          setTimeout(() => {
            if (!this.connected) {
              reject(new Error("Connection timeout"));
            }
          }, this.timeout);
        }).catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle SSE message
   */
  handleSseMessage(event) {
    const data = event.data;
    
    // Check for endpoint event
    if (data.startsWith("event: endpoint")) {
      const lines = data.split("\n");
      for (const line of lines) {
        if (line.startsWith("data:")) {
          this.messageEndpoint = line.substring(5).trim();
          this.emit("endpoint", this.messageEndpoint);
          return;
        }
      }
    }
    
    // Parse JSON message
    try {
      this.handleMessage(data);
    } catch (err) {
      console.error("Failed to handle SSE message:", err);
    }
  }

  /**
   * Send request to MCP server
   */
  async send(data) {
    if (!this.messageEndpoint) {
      throw new Error("Not connected to MCP server");
    }

    const headers = {
      "Content-Type": "application/json",
      ...this.headers,
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.messageEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    // For requests, response body contains the result
    if (data.id !== undefined) {
      const result = await response.json();
      this.handleMessage(JSON.stringify(result));
    }
  }

  /**
   * Close transport
   */
  async close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
  }
}

/**
 * Stdio Transport
 */
export class StdioTransport extends BaseTransport {
  constructor(options) {
    super(options);
    this.command = options.command;
    this.args = options.args || [];
    this.env = options.env || {};
    this.process = null;
    this.buffer = "";
  }

  /**
   * Start the MCP server process
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.command, this.args, {
          env: { ...process.env, ...this.env },
          stdio: ["pipe", "pipe", "pipe"],
        });

        this.process.stdout.on("data", (data) => {
          this.handleStdout(data);
        });

        this.process.stderr.on("data", (data) => {
          console.error(`MCP server stderr: ${data}`);
        });

        this.process.on("error", (error) => {
          this.emit("error", error);
        });

        this.process.on("close", (code) => {
          this.emit("close", code);
        });

        // Wait for process to start
        setTimeout(resolve, 100);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle stdout data
   */
  handleStdout(data) {
    this.buffer += data.toString();
    
    // Process complete JSON messages (newline-delimited)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        this.handleMessage(line);
      }
    }
  }

  /**
   * Send data to process stdin
   */
  send(data) {
    if (!this.process || !this.process.stdin) {
      throw new Error("Process not running");
    }
    this.process.stdin.write(JSON.stringify(data) + "\n");
  }

  /**
   * Close transport
   */
  async close() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

/**
 * Streamable HTTP Transport
 * Implements MCP Streamable HTTP transport (POST-based, no SSE)
 */
export class StreamableHttpTransport extends BaseTransport {
  constructor(options) {
    super(options);
    this.url = options.url;
    this.headers = options.headers || {};
    this.apiKey = options.apiKey;
    this.connected = false;
  }

  /**
   * Connect to MCP server (no persistent connection needed)
   */
  async connect() {
    // Streamable HTTP doesn't need a persistent connection
    // Just verify the server is reachable with a ping
    this.connected = true;
  }

  /**
   * Send request to MCP server
   */
  async send(data) {
    const headers = {
      "Content-Type": "application/json",
      ...this.headers,
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    // For requests with id, response body contains the result
    if (data.id !== undefined) {
      const result = await response.json();
      this.handleMessage(JSON.stringify(result));
    }
  }

  /**
   * Close transport (no-op for stateless HTTP)
   */
  async close() {
    this.connected = false;
  }
}

/**
 * Create transport based on configuration
 */
export function createTransport(config) {
  // Check for explicit type
  if (config.type === "streamablehttp") {
    return new StreamableHttpTransport(config);
  } else if (config.type === "sse") {
    return new HttpSseTransport(config);
  } else if (config.type === "stdio") {
    return new StdioTransport(config);
  }
  
  // Auto-detect based on config
  if (config.url) {
    // Default to Streamable HTTP for URL-based servers
    // (most modern MCP servers use Streamable HTTP)
    return new StreamableHttpTransport(config);
  } else if (config.command) {
    return new StdioTransport(config);
  } else {
    throw new Error("Either url or command must be specified");
  }
}
