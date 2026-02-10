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

  private constructor(
    private logger = new Logger(Tools),
    private config = Config.getInstance(),
  ) {}

  async loadTools(): Promise<ToolDefinition[]> {
    const files = await this.resolveToolFiles();
    this.logger.debug("Resolved tool files", { count: files.length });

    // Load all tools in parallel
    const toolPromises = files.map((filePath) =>
      this.loadToolFromFile(filePath),
    );
    const results = await Promise.allSettled(toolPromises);

    const tools: ToolDefinition[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        tools.push(result.value);
      } else {
        this.logger.error(`Failed to load tool`, {
          file: files[index],
          err: result.reason?.message || result.reason,
        });
      }
    });

    return tools;
  }

  async loadTool(name: string): Promise<ToolDefinition> {
    const files = await this.resolveToolFiles();
    const filePath = files.find(
      (f) => path.basename(f, path.extname(f)) === name,
    );

    if (!filePath) {
      throw new Error(`Tool not found: ${name}`);
    }

    return this.loadToolFromFile(filePath);
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
    const glob = new Glob(this.config.glob);
    const targetFolder = this.config.targetFolder;
    const files: string[] = [];

    for await (const file of glob.scan({ cwd: targetFolder, absolute: true })) {
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
    // Check if the changed file matches our glob pattern
    const glob = new Glob(this.config.glob);
    if (!glob.match(filename)) {
      return;
    }

    this.logger.info("File changed", { event, filename });

    if (this.onChangeCallback) {
      this.onChangeCallback();
    }
  }
}
