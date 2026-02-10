import { z } from "zod";

export const description =
  "Returns the current date/time in the requested format and timezone";

export const inputSchema = z.object({
  format: z
    .enum(["iso", "unix", "human", "relative"])
    .describe(
      "Output format: iso (ISO-8601), unix (epoch seconds), human (readable), or relative (time ago)",
    ),
  timezone: z
    .string()
    .default("UTC")
    .describe("IANA timezone, e.g. America/New_York. Defaults to UTC"),
});

export default async ({ format, timezone }: z.infer<typeof inputSchema>) => {
  // Validate timezone by attempting to use it
  try {
    new Date().toLocaleString("en-US", { timeZone: timezone });
  } catch (e) {
    return {
      isError: true,
      error: `Invalid timezone: '${timezone}'. Please use a valid IANA timezone (e.g., America/New_York, Europe/London, UTC).`,
    };
  }

  const now = new Date();

  const formatters: Record<string, () => string> = {
    iso: () =>
      now.toLocaleString("sv-SE", { timeZone: timezone }).replace(" ", "T") +
      "Z",
    unix: () => String(Math.floor(now.getTime() / 1000)),
    human: () =>
      now.toLocaleString("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
      }),
    relative: () => {
      const now = new Date();
      const seconds = Math.floor((new Date().getTime() - now.getTime()) / 1000);
      if (seconds < 60) return `${Math.abs(seconds)} seconds ago`;
      if (seconds < 3600)
        return `${Math.floor(Math.abs(seconds) / 60)} minutes ago`;
      if (seconds < 86400)
        return `${Math.floor(Math.abs(seconds) / 3600)} hours ago`;
      return `${Math.floor(Math.abs(seconds) / 86400)} days ago`;
    },
  };

  const text = formatters[format]();

  return text;
};
