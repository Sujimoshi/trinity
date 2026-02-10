import { Server as SDKServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import fs from "node:fs";
import path from "node:path";
import { Config } from "./Config.js";
import { Logger } from "./Logger.js";
import { Tools } from "./Tools.js";
import safeJsonStringify from "json-stringify-safe";

export class Server {
  private static instance: Server | null = null;

  static getInstance(): Server {
    if (!Server.instance) {
      Server.instance = new Server();
    }
    return Server.instance;
  }

  private server = new SDKServer(
    { name: "trinity", version: "0.1.0" },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { listChanged: true },
      },
    },
  );

  private constructor(
    private logger = new Logger(Server),
    private config = Config.getInstance(),
    private tools = Tools.getInstance(),
  ) {
    this.registerHandlers();
    this.tools.onChange(() => this.onToolsChanged());
  }

  async start(): Promise<void> {
    this.logger.info(`Starting server in`, {
      mode: this.config.mode,
      targetFolder: this.config.targetFolder,
      glob: this.config.glob,
      port: this.config.port,
    });

    await this.tools.loadTools();

    this.tools.startWatching();

    const transport = await this.createTransport();
    await this.server.connect(transport);

    await this.server.sendToolListChanged();

    await this.server.sendResourceListChanged();

    this.logger.info("Server started successfully");
  }

  async stop(): Promise<void> {
    this.logger.info("Stopping server...");
    this.tools.stopWatching();
    await this.server.close();
    this.logger.info("Server stopped");
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () =>
      this.handleListTools(),
    );

    this.server.setRequestHandler(CallToolRequestSchema, async (request) =>
      this.handleCallTool(request),
    );

    this.server.setRequestHandler(ListResourcesRequestSchema, async () =>
      this.handleListResources(),
    );

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) =>
      this.handleReadResource(request),
    );
  }

  private async handleListTools() {
    this.logger.debug("Handling list_tools request");

    const toolDefs = await this.tools.loadTools();

    const tools = toolDefs.map((tool) => {
      // Convert Zod schema to JSON Schema for the MCP protocol
      const jsonSchema = tool.inputSchema.toJSONSchema();

      this.logger.debug(`Generated JSON schema for tool`, {
        name: tool.name,
        jsonSchema,
      });

      return {
        name: tool.name,
        description: tool.description,
        inputSchema: jsonSchema as {
          type: "object";
          properties?: Record<string, unknown>;
          required?: string[];
        },
      };
    });

    this.logger.debug(`Returning ${tools.length} tools`);
    return { tools };
  }

  private async handleCallTool(request: {
    params: { name: string; arguments?: Record<string, unknown> };
  }) {
    const { name, arguments: args } = request.params;
    this.logger.info(`Calling tool: ${name}`);

    try {
      const tool = await this.tools.loadTool(name);
      const raw = await tool.execute(args || {});
      this.logger.debug(`Tool ${name} executed successfully`, { raw });

      return this.formatToolResult(raw);
    } catch (err) {
      this.logger.error(`Tool ${name} execution failed`, err as Error);
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private formatToolResult(raw: any) {
    // Handle arrays: each item becomes a content item
    if (Array.isArray(raw)) {
      return { content: raw.map((item) => this.formatContentItem(item)) };
    }

    // Handle objects with MCP content types (image, audio, resource_link, resource)
    if (raw && typeof raw === "object") {
      return {
        content: [{ type: "text", text: safeJsonStringify(raw, null, 2) }],
        structuredContent: raw,
      };
    }

    return { content: [{ type: "text", text: String(raw) }] };
  }

  private formatContentItem(item: any): any {
    // If it's already an MCP content item, return as-is
    if (item && typeof item === "object" && "type" in item) {
      return item;
    }

    // Otherwise, convert to text
    const text =
      typeof item === "string"
        ? item
        : item === null || item === undefined
          ? String(item)
          : typeof item === "object"
            ? JSON.stringify(item, null, 2)
            : String(item);

    return { type: "text", text };
  }

  private async createTransport(): Promise<Transport> {
    if (this.config.mode === "stdio") {
      this.logger.info("Using stdio transport");
      return new StdioServerTransport();
    }

    this.logger.info(`Starting HTTP server on port ${this.config.port}`);
    return this.createHttpTransport();
  }

  private async createHttpTransport(): Promise<Transport> {
    // Use WebStandardStreamableHTTPServerTransport — works natively with Bun's fetch API
    const { WebStandardStreamableHTTPServerTransport } =
      await import("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js");

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    Bun.serve({
      port: this.config.port,
      fetch: async (req: Request): Promise<Response> => {
        const url = new URL(req.url);

        if (url.pathname === "/mcp") {
          return await transport.handleRequest(req);
        }

        if (url.pathname === "/health") {
          return new Response(JSON.stringify({ status: "ok" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response("Not Found", { status: 404 });
      },
    });

    this.logger.info(`HTTP server listening on port ${this.config.port}`);
    return transport;
  }

  private async handleListResources() {
    this.logger.debug("Handling list_resources request");

    const resources = [
      {
        uri: "trinity://docs/tools",
        name: "How to implement/define Tools",
        description:
          "Comprehensive guide for creating and managing tools with Trinity MCP, including schemas, hot reload, and best practices",
        mimeType: "text/markdown",
      },
    ];

    this.logger.debug(`Returning ${resources.length} resources`);
    return { resources };
  }

  private async handleReadResource(request: { params: { uri: string } }) {
    const { uri } = request.params;
    this.logger.info(`Reading resource: ${uri}`);

    if (uri === "trinity://docs/tools") {
      try {
        const docsPath = path.resolve(import.meta.dir, "../docs/TOOLS.md");
        const content = fs.readFileSync(docsPath, "utf-8");

        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      } catch (err) {
        this.logger.error(`Failed to read resource ${uri}`, err as Error);
        throw new Error(`Failed to read resource: ${(err as Error).message}`);
      }
    }

    throw new Error(`Resource not found: ${uri}`);
  }

  private onToolsChanged(): void {
    this.logger.info("Tools changed, notifying clients");
    this.server.sendToolListChanged().catch((err: Error) => {
      this.logger.error("Failed to send tool list changed notification", err);
    });
  }
}
