import path from "node:path";
import fs from "node:fs";

export class Config {
  private static instance: Config | null = null;

  private _mode: "stdio" | "http" = "stdio";
  private _targetFolder: string = "";
  private _glob: string = "**/*.ts";
  private _logFile: string = "";
  private _port: number = 3000;

  private constructor() {}

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  parse(argv: string[]): void {
    // Parse CLI arguments
    for (let i = 0; i < argv.length; i++) {
      switch (argv[i]) {
        case "--target":
          this._targetFolder = argv[++i];
          break;
        case "--glob":
          this._glob = argv[++i];
          break;
        case "--port":
          this._port = parseInt(argv[++i], 10);
          break;
      }
    }

    // Env fallbacks (CLI takes priority)
    const envMode = process.env.MCP_MODE;
    if (envMode === "http" || envMode === "stdio") {
      this._mode = envMode;
    }

    if (!this._glob || this._glob === "**/*.ts") {
      this._glob = process.env.MCP_GLOB || "**/*.ts";
    }

    if (process.env.LOG_FILE) {
      this._logFile = process.env.LOG_FILE;
    }

    if (!this._targetFolder) {
      throw new Error(
        "Missing required argument: --target <path>. Specify the folder containing tool files.",
      );
    }

    // Resolve to absolute path
    this._targetFolder = path.resolve(this._targetFolder);

    // Create target folder if it doesn't exist
    if (!fs.existsSync(this._targetFolder)) {
      fs.mkdirSync(this._targetFolder, { recursive: true });
    }

    // Default log file relative to target folder
    if (!this._logFile) {
      this._logFile = path.join(this._targetFolder, "debug.log");
    }
  }

  get mode(): "stdio" | "http" {
    return this._mode;
  }

  get targetFolder(): string {
    return this._targetFolder;
  }

  get glob(): string {
    return this._glob;
  }

  get logFile(): string {
    return this._logFile;
  }

  get logDest(): "stdout" | "file" {
    return this._mode === "http" ? "stdout" : "file";
  }

  get port(): number {
    return this._port;
  }
}
