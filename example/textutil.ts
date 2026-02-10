import { z } from "zod";

export const description = "Transforms text to different cases";

export const inputSchema = z.object({
  text: z.string().describe("The text to transform"),
  case: z
    .enum(["upper", "lower", "title", "reverse", "capitalize"])
    .describe(
      "The transformation: upper, lower, title, reverse, or capitalize",
    ),
  repeat: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Number of times to apply the transformation (default: 1)"),
});

export default async ({
  text,
  case: caseType,
  repeat,
}: z.infer<typeof inputSchema>) => {
  const transformers: Record<string, (s: string) => string> = {
    upper: (s) => s.toUpperCase(),
    lower: (s) => s.toLowerCase(),
    title: (s) =>
      s
        .split(" ")
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
        )
        .join(" "),
    reverse: (s) => s.split("").reverse().join(""),
    capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(),
  };

  let result = text;
  for (let i = 0; i < repeat; i++) {
    result = transformers[caseType](result);
  }

  return result;
};
