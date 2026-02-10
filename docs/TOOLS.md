# Trinity MCP Tools Guide

This guide explains how to create, structure, and manage tools in the Trinity MCP server.

## Overview

Tools are dynamically loaded TypeScript modules that perform actions and are exposed via the Model Context Protocol (MCP). Trinity automatically detects, loads, and reloads tools without requiring a server restart.

## Tool Location & Discovery

**Default Location**: `example/` directory (configured via `--target` or `MCP_TARGET` environment variable)

Tools are discovered using a glob pattern:

- **Default Pattern**: `**/*.ts` (all TypeScript files in target folder)
- **Custom Pattern**: Set via `--glob` or `MCP_GLOB` environment variable

**File Naming**: Tool names are derived from the filename (without extension)

- File: `hello.ts` → Tool name: `mcp_trinity_hello`
- File: `timestamp.ts` → Tool name: `mcp_trinity_timestamp`

## Tool File Structure

Every tool file must export three things:

### 1. `description` (required)

A string describing what the tool does.

```typescript
export const description = "Says hello to a person by name";
```

Trinity automatically appends source information to the description for the MCP client:

- Shows the source file path
- Notes that the tool is dynamically loaded
- Indicates that changes to the file immediately affect behavior

Example expanded description shown to clients:

```
Says hello to a person by name

---
Source: /path/to/example/hello.ts
Note: This tool is dynamically loaded. Changes to this file will immediately affect this tool's behavior. You can read and modify this file to change the tool.
```

### 2. `inputSchema` (required)

A Zod schema defining the tool's input parameters. Must be a `z.object()`.

```typescript
import { z } from "zod";

export const inputSchema = z.object({
  name: z.string().describe("The person's name to greet"),
  greeting: z
    .string()
    .default("Hello")
    .describe("The greeting prefix (default: Hello)"),
});
```

**Schema Features**:

- **Type Support**: All Zod types (string, number, boolean, enum, array, etc.)
- **Descriptions**: Use `.describe()` to document each parameter (shown in MCP client)
- **Defaults**: Use `.default()` to provide default values
- **Validation**: Zod handles validation automatically (min, max, regex patterns, etc.)

Example with more complex validation:

```typescript
export const inputSchema = z.object({
  count: z.number().int().min(1).max(100).describe("Number between 1-100"),
  format: z.enum(["json", "csv", "xml"]).describe("Output format"),
  options: z
    .object({
      verbose: z.boolean().default(false),
      depth: z.number().int().min(0).max(5),
    })
    .optional(),
});
```

### 3. Default Export Function (required)

An async function that executes the tool. Must accept the validated arguments and return the result.

**Typing**: Use `z.infer<typeof inputSchema>` for TypeScript type safety

- Automatically infers types from your Zod schema
- Provides IDE autocomplete for parameters

**Return Format**: Tools can return simple values—Trinity automatically converts them to MCP-compatible format:

#### Return Primitives (Recommended)

Return strings, numbers, or booleans directly:

```typescript
// String result
export default async ({ name }: z.infer<typeof inputSchema>) => {
  return `Hello, ${name}!`;
};

// Number result
export default async ({ a, b }: z.infer<typeof inputSchema>) => {
  return a + b;
};

// Boolean result
export default async ({ value }: z.infer<typeof inputSchema>) => {
  return value > 0;
};
```

#### Return Objects (Structured Content)

Return objects for structured data—Trinity creates both text and structured content:

```typescript
export default async ({ location }: z.infer<typeof inputSchema>) => {
  return {
    temperature: 22.5,
    conditions: "Partly cloudy",
    humidity: 65,
  };
};
```

Server automatically provides:

- `content: [{ type: "text", text: "{...JSON...}" }]` for backward compatibility
- `structuredContent: { temperature: 22.5, ... }` for clients that support it

#### Return Arrays

Return arrays to create multiple content items:

```typescript
export default async ({ items }: z.infer<typeof inputSchema>) => {
  return ["First item", "Second item", "Third item"];
};
```

#### Error Handling

**Option 1: Return error object** (recommended for validation errors):

```typescript
export default async ({ location }: z.infer<typeof inputSchema>) => {
  if (!isValidLocation(location)) {
    return {
      isError: true,
      error: `Location '${location}' not found. Please provide a valid city name.`,
    };
  }
  return getWeatherData(location);
};
```

**Option 2: Throw exception** (for unexpected errors):

```typescript
export default async ({ apiKey }: z.infer<typeof inputSchema>) => {
  if (!apiKey) {
    throw new Error("API key is required");
  }
  return await callExternalAPI(apiKey);
};
```

Both approaches result in MCP-compatible error responses with `isError: true`.

#### Advanced: Return MCP Content Types

For advanced use cases, return MCP content objects directly:

```typescript
// Image content
return {
  type: "image",
  data: "base64-encoded-data",
  mimeType: "image/png",
};

// Resource link
return {
  type: "resource_link",
  uri: "file:///path/to/file.txt",
  name: "file.txt",
};
```

## Complete Tool Example

Here's a complete, self-contained tool example:

```typescript
import { z } from "zod";

export const description = "Transforms text to different cases";

export const inputSchema = z.object({
  text: z.string().describe("The text to transform"),
  case: z
    .enum(["upper", "lower", "title", "reverse"])
    .describe("The transformation type"),
  repeat: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Number of times to apply (default: 1)"),
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
  };

  let result = text;
  for (let i = 0; i < repeat; i++) {
    result = transformers[caseType](result);
  }

  // Return the string directly - Trinity handles MCP formatting
  return result;
};
```

## Automatic MCP Formatting

Trinity automatically converts tool return values into MCP-compatible responses. You don't need to worry about the MCP protocol format—just return your data naturally.

### How It Works

| Tool Returns                      | Trinity Creates                                                            |
| --------------------------------- | -------------------------------------------------------------------------- |
| String, number, boolean           | `{ content: [{ type: "text", text: "value" }] }`                           |
| Object                            | `{ content: [{ type: "text", text: "{...}" }], structuredContent: {...} }` |
| Array                             | `{ content: [item1, item2, ...] }` (each item becomes content)             |
| `{ isError: true, error: "..." }` | `{ content: [{ type: "text", text: "..." }], isError: true }`              |
| Thrown exception                  | `{ content: [{ type: "text", text: "Error: ..." }], isError: true }`       |
| MCP content object                | Used directly (advanced)                                                   |

### Examples

```typescript
// Tool returns: "Hello, World!"
// MCP response: { content: [{ type: "text", text: "Hello, World!" }] }

// Tool returns: 42
// MCP response: { content: [{ type: "text", text: "42" }] }

// Tool returns: { temp: 22.5, conditions: "Sunny" }
// MCP response: {
//   content: [{ type: "text", text: '{"temp": 22.5, "conditions": "Sunny"}' }],
//   structuredContent: { temp: 22.5, conditions: "Sunny" }
// }

// Tool returns: { isError: true, error: "Not found" }
// MCP response: {
//   content: [{ type: "text", text: "Not found" }],
//   isError: true
// }
```

This automatic formatting follows the [MCP specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools#tool-result) for tool results.

## Hot Reload

Trinity includes a file watcher that automatically detects changes to tool files.

### How It Works

1. **File Monitoring**: Trinity watches the target folder for file changes
2. **Detection**: When a tool file is modified and saved, the file watcher detects the change
3. **Notification**: Trinity sends a `tools/listChanged` notification to all connected MCP clients
4. **Cache Busting**: Dynamic imports use a timestamp (`?t=Date.now()`) to bypass module caching
5. **Immediate Availability**: The updated tool is immediately available with new schema and implementation

### No Server Restart Required

You can:

- Add new tool files (automatically detected)
- Modify existing tool implementations (hot reloaded)
- Change input schemas and parameters (clients are notified)
- Fix bugs and see changes instantly

Example workflow:

```bash
# Terminal 1: Start the server (stays running)
bun run src/index.ts --target example

# Terminal 2: Make changes to a tool file
# Edit example/hello.ts - save the file
# The change is immediately available with no restart needed
```

### Caveats

- **VS Code MCP Client Caching**: VS Code's MCP client may cache the schema locally. To see updated enum values or new parameters, you may need to restart the MCP client or reload VS Code
- **Server-side works immediately**: The server-side tool execution updates instantly
- **Client-side UI delay**: The MCP client UI may show the old schema temporarily

## Built-in Examples

Trinity includes several example tools demonstrating different patterns:

### `hello.ts`

Greeting tool with customizable greeting prefix.

- **Params**: `name` (string), `greeting` (optional string)
- **Shows**: Basic tool structure, optional parameters

### `calculator.ts`

Mathematical operations with parameter validation.

- **Params**: `operation` (enum), `a` (number), `b` (number)
- **Shows**: Enum validation, numeric operations

### `timestamp.ts`

Date/time formatting with timezone support.

- **Params**: `format` (enum: iso/unix/human/relative), `timezone` (string)
- **Shows**: Multiple output formats, optional parameters with defaults

### `textutil.ts`

Text transformation with repetition.

- **Params**: `text` (string), `case` (enum), `repeat` (integer with min/max)
- **Shows**: String transformations, iteration, validation ranges

### `random.ts`

Random value generation (number, string, UUID, boolean).

- **Params**: `type` (enum), `min` (optional), `max` (optional), `length` (optional)
- **Shows**: Different value types, conditional parameters, crypto usage

## Best Practices

### 1. Clear Descriptions

```typescript
// Good
export const description = "Generates a random UUID v4";

// Avoid
export const description = "Random tool";
```

### 2. Descriptive Parameter Labels

```typescript
// Good
z.string().describe("The email address to validate"),

// Avoid
z.string().describe("email"),
```

### 3. Use Enums for Choices

```typescript
// Good
z.enum(["json", "csv", "xml"]).describe("Output format"),

// Avoid
z.string().describe("Format: json, csv, or xml"),
```

### 4. Provide Defaults

```typescript
// Good
z.number().default(10).describe("Limit (default: 10)"),

// Avoid
z.number().describe("Limit (required)"),
```

### 5. Validate Inputs Early

```typescript
// Good
z.number().int().min(0).max(100),

// Avoid
z.number(), // then validate in execution
```

### 6. Handle Errors Gracefully

```typescript
// Option 1: Return error object for validation errors
export default async ({ date }: z.infer<typeof inputSchema>) => {
  if (new Date(date) < new Date()) {
    return {
      isError: true,
      error: `Invalid date: must be in the future. Current date is ${new Date().toLocaleDateString()}.`,
    };
  }
  return processDate(date);
};

// Option 2: Let exceptions bubble up for unexpected errors
export default async ({ apiKey }: z.infer<typeof inputSchema>) => {
  // Trinity will catch and format as MCP error
  const data = await externalAPI.call(apiKey); // may throw
  return data;
};
```

### 7. Use Type Inference

```typescript
// Good
export default async ({ param1, param2 }: z.infer<typeof inputSchema>) => {
  // param1 and param2 are properly typed
},

// Avoid
export default async (args: any) => {
  // No type safety
},
```

## Configuration

Tools behavior is controlled via CLI arguments or environment variables:

```bash
# Specify tool directory
bun run src/index.ts --target ./my-tools

# Specify glob pattern
bun run src/index.ts --glob "tools/**/*.ts"

# Combined
bun run src/index.ts --target ./my-tools --glob "*.ts"
```

Environment variables:

- `MCP_TARGET`: Tool directory (default: `example`)
- `MCP_GLOB`: Glob pattern (default: `**/*.ts`)
- `MCP_MODE`: `stdio` or `http` (default: `stdio`)
- `MCP_PORT`: HTTP port (default: `3001`)
- `LOG_FILE`: Log file path (optional, defaults to stderr)

## Troubleshooting

### Tool Not Found

- Check file is in the target directory
- Verify filename matches the tool name (exclude `.ts` extension)
- Check glob pattern matches the file

### Schema Not Updating

- Trinity sends `tools/listChanged` notification
- VS Code MCP client may cache the schema locally
- Try restarting the MCP client or reloading VS Code

### Type Errors

- Ensure `inputSchema` is a `z.object()`
- Use `z.infer<typeof inputSchema>` for typing
- Check for typos in parameter names

### Parameters Not Passed

- VS Code MCP client doesn't always pass parameters to the LLM initially
- The schema is correct on the server side
- This is a known VS Code MCP client limitation

## Advanced Examples

### File Processing Tool

```typescript
import { z } from "zod";
import fs from "node:fs";

export const description = "Reads and processes a file";

export const inputSchema = z.object({
  filepath: z.string().describe("Path to the file to read"),
  encoding: z
    .enum(["utf8", "ascii", "base64"])
    .default("utf8")
    .describe("File encoding (default: utf8)"),
  maxLines: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Maximum lines to read (optional)"),
});

export default async ({
  filepath,
  encoding,
  maxLines,
}: z.infer<typeof inputSchema>) => {
  try {
    const content = fs
      .readFileSync(filepath, encoding as BufferEncoding)
      .toString();
    const lines = content.split("\n");
    const limitedLines = maxLines ? lines.slice(0, maxLines) : lines;

    // Return the string directly
    return limitedLines.join("\n");
  } catch (error) {
    // Return error object
    return {
      isError: true,
      error: `Failed to read file: ${(error as Error).message}`,
    };
  }
};
```

### Weather API Tool (Structured Data)

```typescript
import { z } from "zod";

export const description = "Returns structured weather data for a location";

export const inputSchema = z.object({
  location: z.string().describe("City name"),
});

export default async ({ location }: z.infer<typeof inputSchema>) => {
  // Validate input
  if (location.toLowerCase() === "unknown") {
    return {
      isError: true,
      error: `Location '${location}' not found. Please provide a valid city name.`,
    };
  }

  // Return structured data - Trinity provides both text and structuredContent
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
```

## Summary

Trinity tools are simple, self-contained TypeScript modules that:

- Are automatically discovered from the target directory
- Define their interface via Zod schemas
- Return simple values (strings, numbers, objects)—Trinity handles MCP formatting
- Execute with validated, type-safe parameters
- Support hot reload without server restart
- Are exposed via the Model Context Protocol to AI clients

### Key Benefits

- **Simple API**: Return strings, numbers, or objects—no need to understand MCP protocol
- **Automatic Formatting**: Trinity converts your returns to MCP-compatible responses
- **Structured Data**: Objects automatically get both text and structured content
- **Error Handling**: Both exceptions and error objects are properly formatted
- **Type Safety**: Full TypeScript support with Zod schema inference
- **Hot Reload**: Changes are immediately available without server restart

Create new tools by adding `.ts` files to your target directory. Changes are immediately detected and available—no server restart needed.
