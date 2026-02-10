import { z } from "zod";

export const description = "Returns structured weather data for a location";

export const inputSchema = z.object({
  location: z.string().describe("City name"),
});

export default async ({ location }: z.infer<typeof inputSchema>) => {
  // Simulate API error for certain locations
  if (location.toLowerCase() === "error") {
    throw new Error("Failed to fetch weather data: API connection timeout");
  }

  // Simulate validation error
  if (location.toLowerCase() === "unknown") {
    return {
      isError: true,
      error: `Location '${location}' not found. Please provide a valid city name.`,
    };
  }

  // Return structured data
  return {
    location,
    temperature: 22.5,
    conditions: "Partly cloudy",
    humidity: 65,
    wind: {
      speed: 12,
      direction: "NW",
    },
  };
};
