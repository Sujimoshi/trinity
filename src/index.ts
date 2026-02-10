#!/usr/bin/env bun

import { Config } from "./Config.js";
import { Server } from "./Server.js";
import { Logger } from "./Logger.js";

const logger = new Logger("main");

try {
  Config.getInstance().parse(process.argv.slice(2));
} catch (err) {
  logger.error((err as Error).message);
  logger.error(
    "Usage: bun --hot src/index.ts --target <path> [--glob <pattern>] [--port <number>]",
  );
  process.exit(1);
}

const server = Server.getInstance();

process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down...");
  await server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down...");
  await server.stop();
  process.exit(0);
});

try {
  await server.start();
} catch (err) {
  logger.error("Failed to start server", err as Error);
  process.exit(1);
}
