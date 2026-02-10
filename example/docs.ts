import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

export const description =
  "Returns Trinity MCP documentation about tool development, schemas, hot reload, and best practices";

export const inputSchema = z.object({});

export default async () => {
  try {
    const docsPath = path.resolve(import.meta.dir, "../docs/TOOLS.md");
    const content = fs.readFileSync(docsPath, "utf-8");

    return content;
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: `Failed to read documentation: ${(error as Error).message}`,
        },
      ],
      isError: true,
    };
  }
};
