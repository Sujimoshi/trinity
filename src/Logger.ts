import fs from "node:fs";
import { Config } from "./Config.js";
import safeJsonStringify from "json-stringify-safe";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

export class Logger {
  private name: string;
  private config: Config;
  private logQueue: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isWriting = false;
  private static readonly MAX_QUEUE_SIZE = 1000;
  private static readonly FLUSH_INTERVAL_MS = 100;

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
      this.queueLog(formatted);
    }
  }

  private queueLog(message: string): void {
    this.logQueue.push(message);
    
    // If queue is getting too large, flush immediately
    if (this.logQueue.length >= Logger.MAX_QUEUE_SIZE) {
      if (this.flushTimer) {
        clearTimeout(this.flushTimer);
        this.flushTimer = null;
      }
      this.flushLogs();
    } else if (!this.flushTimer) {
      // Schedule flush if not already scheduled
      this.flushTimer = setTimeout(() => this.flushLogs(), Logger.FLUSH_INTERVAL_MS);
    }
  }

  private async flushLogs(): Promise<void> {
    this.flushTimer = null;
    
    if (this.isWriting || this.logQueue.length === 0) {
      return;
    }

    this.isWriting = true;
    const logsToWrite = this.logQueue.splice(0);
    const content = logsToWrite.join("\n") + "\n";

    try {
      await fs.promises.appendFile(this.config.logFile, content);
    } catch (err) {
      // Fallback to console if file write fails
      console.error("Failed to write to log file:", err);
      console.error(content);
    } finally {
      this.isWriting = false;
      
      // If more logs were queued while writing, schedule another flush
      // Use non-recursive approach: schedule a new timer instead of calling directly
      if (this.logQueue.length > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(() => this.flushLogs(), Logger.FLUSH_INTERVAL_MS);
      }
    }
  }
}
