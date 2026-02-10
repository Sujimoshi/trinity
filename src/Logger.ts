import fs from "node:fs";
import { Config } from "./Config.js";
import safeJsonStringify from "json-stringify-safe";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export class Logger {
  private name: string;
  private config: Config;

  constructor(requester: string | { name: string }) {
    this.name = typeof requester === "string" ? requester : requester.name;
    this.config = Config.getInstance();
  }

  debug(msg: string, meta?: any): void {
    this.log("DEBUG", msg, meta);
  }

  info(msg: string, meta?: any): void {
    this.log("INFO", msg, meta);
  }

  warn(msg: string, meta?: any): void {
    this.log("WARN", msg, meta);
  }

  error(msg: string, meta?: any): void {
    this.log("ERROR", msg, meta);
  }

  private format(level: LogLevel, msg: string, meta: any = {}): string {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      name: this.name,
      msg,
      ...(Object.keys(meta).length > 0 && { meta }),
    };
    return safeJsonStringify(logEntry);
  }

  private log(level: LogLevel, msg: string, meta?: any): void {
    const formatted = this.format(level, msg, meta);
    if (this.config.logDest === "stdout") {
      console.error(formatted);
    } else {
      fs.appendFileSync(this.config.logFile, formatted + "\n");
    }
  }
}
