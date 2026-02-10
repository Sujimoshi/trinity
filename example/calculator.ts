import { z } from "zod";

export const description = "Performs basic arithmetic operations";

export const inputSchema = z.object({
  operation: z
    .enum(["add", "subtract", "multiply", "divide"])
    .describe("The arithmetic operation to perform"),
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
});

export default async ({ operation, a, b }: z.infer<typeof inputSchema>) => {
  let result: number;

  switch (operation) {
    case "add":
      result = a + b;
      break;
    case "subtract":
      result = a - b;
      break;
    case "multiply":
      result = a * b;
      break;
    case "divide":
      if (b === 0) {
        return { isError: true, error: "Division by zero" };
      }
      result = a / b;
      break;
  }

  return result;
};
