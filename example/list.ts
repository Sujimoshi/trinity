import { z } from "zod";

export const description =
  "Returns a list of items based on the requested type";

export const inputSchema = z.object({
  type: z
    .enum(["colors", "numbers", "fruits", "languages"])
    .describe("The type of list to return"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe("Maximum number of items to return (default: 5)"),
});

export default async ({ type, limit }: z.infer<typeof inputSchema>) => {
  const lists: Record<string, any[]> = {
    colors: [
      { name: "Red", hex: "#FF0000", rgb: { r: 255, g: 0, b: 0 } },
      { name: "Blue", hex: "#0000FF", rgb: { r: 0, g: 0, b: 255 } },
      { name: "Green", hex: "#00FF00", rgb: { r: 0, g: 255, b: 0 } },
      { name: "Yellow", hex: "#FFFF00", rgb: { r: 255, g: 255, b: 0 } },
      { name: "Purple", hex: "#800080", rgb: { r: 128, g: 0, b: 128 } },
      { name: "Orange", hex: "#FFA500", rgb: { r: 255, g: 165, b: 0 } },
      { name: "Pink", hex: "#FFC0CB", rgb: { r: 255, g: 192, b: 203 } },
      { name: "Brown", hex: "#A52A2A", rgb: { r: 165, g: 42, b: 42 } },
      { name: "Black", hex: "#000000", rgb: { r: 0, g: 0, b: 0 } },
      { name: "White", hex: "#FFFFFF", rgb: { r: 255, g: 255, b: 255 } },
    ],
    numbers: [
      { value: 1, name: "One", prime: false },
      { value: 2, name: "Two", prime: true },
      { value: 3, name: "Three", prime: true },
      { value: 4, name: "Four", prime: false },
      { value: 5, name: "Five", prime: true },
      { value: 6, name: "Six", prime: false },
      { value: 7, name: "Seven", prime: true },
      { value: 8, name: "Eight", prime: false },
      { value: 9, name: "Nine", prime: false },
      { value: 10, name: "Ten", prime: false },
    ],
    fruits: [
      { name: "Apple", calories: 95, color: "Red" },
      { name: "Banana", calories: 105, color: "Yellow" },
      { name: "Orange", calories: 62, color: "Orange" },
      { name: "Grape", calories: 62, color: "Purple" },
      { name: "Mango", calories: 135, color: "Yellow" },
      { name: "Strawberry", calories: 49, color: "Red" },
      { name: "Pineapple", calories: 82, color: "Yellow" },
      { name: "Kiwi", calories: 61, color: "Green" },
      { name: "Watermelon", calories: 86, color: "Red" },
      { name: "Peach", calories: 59, color: "Orange" },
    ],
    languages: [
      { name: "JavaScript", year: 1995, paradigm: "Multi-paradigm" },
      { name: "Python", year: 1991, paradigm: "Multi-paradigm" },
      { name: "TypeScript", year: 2012, paradigm: "Multi-paradigm" },
      { name: "Rust", year: 2010, paradigm: "Multi-paradigm" },
      { name: "Go", year: 2009, paradigm: "Concurrent" },
      { name: "Java", year: 1995, paradigm: "Object-oriented" },
      { name: "C++", year: 1985, paradigm: "Multi-paradigm" },
      { name: "Ruby", year: 1995, paradigm: "Object-oriented" },
      { name: "Swift", year: 2014, paradigm: "Multi-paradigm" },
      { name: "Kotlin", year: 2011, paradigm: "Multi-paradigm" },
    ],
  };

  const items = lists[type].slice(0, limit);

  // Return an array of objects - Trinity will create a content item for each element
  return items;
};
