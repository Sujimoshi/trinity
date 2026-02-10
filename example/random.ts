import { z } from "zod";

export const description = "Generates random values of different types";

export const inputSchema = z.object({
  type: z
    .enum(["number", "string", "uuid", "boolean"])
    .describe("The type of random value to generate"),
  min: z
    .number()
    .optional()
    .describe("Minimum value for number type (default: 0)"),
  max: z
    .number()
    .optional()
    .describe("Maximum value for number type (default: 100)"),
  length: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Length of random string (default: 10)"),
});

export default async ({
  type,
  min = 0,
  max = 100,
  length = 10,
}: z.infer<typeof inputSchema>) => {
  let result: string;

  switch (type) {
    case "number": {
      const value = Math.floor(Math.random() * (max - min + 1)) + min;
      result = String(value);
      break;
    }
    case "string": {
      const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      result = Array.from(
        { length },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");
      break;
    }
    case "uuid": {
      result = crypto.randomUUID();
      break;
    }
    case "boolean": {
      result = String(Math.random() < 0.5);
      break;
    }
  }

  // Return the raw result (string/number/boolean)
  if (type === "number") return Number(result);
  if (type === "boolean") return result === "true";
  return result;
};
