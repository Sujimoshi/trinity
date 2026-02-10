import { z } from "zod";

export const description =
  "Returns a raw value (string) without MCP formatting";

export const inputSchema = z.object({});

export default async () => {
  // Return a plain string (not MCP-wrapped)
  return "this is a raw string result";
};
