import fs from "node:fs";
import path from "node:path";
import { Glob } from "bun";
import { Config } from "./Config.js";
import { Logger } from "./Logger.js";
import { ZodType } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodType;
  execute: (args: Record<string, unknown>) => Promise<any>;
}

export class Tools {
  private static instance: Tools | null = null;

  static getInstance(): Tools {
    if (!Tools.instance) {
      Tools.instance = new Tools();
    }
    return Tools.instance;
  }

  private watcher: fs.FSWatcher | null = null;
  private onChangeCallback: (() => void) | null = null;
  private globPattern: Glob;
  private toolCache: Map<string, ToolDefinition> = new Map();
  private toolPathMap: Map<string, string> = new Map();
  private cacheValid = false;

  private constructor(
    private logger = new Logger(Tools),
    private config = Config.getInstance(),
  ) {
    this.globPattern = new Glob(this.config.glob);
  }

  async loadTools(): Promise<ToolDefinition[]> {
    // Return cached tools if cache is valid
    if (this.cacheValid && this.toolCache.size > 0) {
      this.logger.debug("Returning cached tools", { count: this.toolCache.size });
      return Array.from(this.toolCache.values());
    }

    const files = await this.resolveToolFiles();
    this.logger.debug("Resolved tool files", { count: files.length });

    // Clear caches
    this.toolCache.clear();
    this.toolPathMap.clear();

    // Load all tools in parallel
    const toolPromises = files.map(async (filePath) => {
      return this.loadToolFromFile(filePath).catch((err) => {
        this.logger.error("Failed to load tool from file", {
          file: filePath,
          err: (err as Error).message,
        });
      });
    });

    const results = await Promise.all(toolPromises);
    const tools = results.filter(Boolean) as ToolDefinition[];

    // Cache the results
    for (const tool of tools) {
      this.toolCache.set(tool.name, tool);
    }

    this.cacheValid = true;
    return tools;
  }

  async loadTool(name: string): Promise<ToolDefinition> {
    // Check cache first
    if (this.cacheValid && this.toolCache.has(name)) {
      this.logger.debug("Returning cached tool", { name });
      return this.toolCache.get(name)!;
    }

    // If not cached, look up the file path
    let filePath = this.toolPathMap.get(name);
    
    if (!filePath) {
      // Need to scan files to find the tool
      const files = await this.resolveToolFiles();
      filePath = files.find(
        (f) => path.basename(f, path.extname(f)) === name,
      );

      if (!filePath) {
        throw new Error(`Tool not found: ${name}`);
      }

      // Cache the path mapping
      this.toolPathMap.set(name, filePath);
    }

    const tool = await this.loadToolFromFile(filePath);
    this.toolCache.set(name, tool);
    return tool;
  }

  onChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  startWatching(): void {
    const targetFolder = this.config.targetFolder;
    this.logger.info("Watching for changes", { targetFolder });

    this.watcher = fs.watch(
      targetFolder,
      { recursive: true },
      (event: string, filename: string | null) => {
        if (filename) {
          this.onFileChange(event, filename);
        }
      },
    );

    // Attach error handler immediately to avoid race condition
    this.watcher.on("error", (err: Error) => {
      this.logger.error("Watcher error", err);
    });
  }

  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.info("Stopped watching for changes");
    }
  }

  private async resolveToolFiles(): Promise<string[]> {
    const targetFolder = this.config.targetFolder;
    const files: string[] = [];

    for await (const file of this.globPattern.scan({ cwd: targetFolder, absolute: true })) {
      files.push(file);
    }

    return files;
  }

  private async loadToolFromFile(filePath: string): Promise<ToolDefinition> {
    const mod = await this.dynamicImport(filePath);
    const name = path.basename(filePath, path.extname(filePath));

    if (!mod.description || typeof mod.description !== "string") {
      throw new Error(
        `Tool file ${filePath} must export a 'description' string`,
      );
    }

    if (!mod.inputSchema || typeof mod.inputSchema !== "object") {
      throw new Error(
        `Tool file ${filePath} must export an 'inputSchema' object`,
      );
    }

    if (!mod.default || typeof mod.default !== "function") {
      throw new Error(
        `Tool file ${filePath} must have a default export function (execute)`,
      );
    }

    // Cache the path mapping
    this.toolPathMap.set(name, filePath);

    return {
      name,
      description: this.buildDescription(mod.description, filePath),
      inputSchema: mod.inputSchema as ZodType,
      execute: mod.default as ToolDefinition["execute"],
    };
  }

  private async dynamicImport(
    filePath: string,
  ): Promise<Record<string, unknown>> {
    try {
      // Cache-busting with timestamp to always get fresh module
      return import(`${filePath}?t=${Date.now()}`);
    } catch (err) {
      this.logger.error(`Failed to import tool module`, {
        err: (err as Error).message,
        filePath,
      });

      throw err;
    }
  }

  private buildDescription(description: string, filePath: string): string {
    return [
      description,
      "",
      "---",
      `Source: ${filePath}`,
      "Note: This tool is dynamically loaded. Changes to this file will immediately affect this tool's behavior. You can read and modify this file to change the tool.",
    ].join("\n");
  }

  private onFileChange(event: string, filename: string): void {
    // Check if the changed file matches our glob pattern (use cached glob)
    if (!this.globPattern.match(filename)) {
      return;
    }

    this.logger.info("File changed", { event, filename });

    // Invalidate cache when files change
    this.cacheValid = false;

    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }
}
