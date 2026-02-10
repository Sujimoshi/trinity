import { z } from "zod";

export const description = "Says hello to a person by name";

export const inputSchema = z.object({
  name: z.string().describe("The person's name to greet"),
});

export default async ({ name }: z.infer<typeof inputSchema>) => {
  return `Hello, ${name}!`;
};
