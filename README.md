# Trinity MCP

A lightweight [MCP](https://modelcontextprotocol.io/) server framework for [Bun](https://bun.sh) with dynamic tool loading, hot reload, and stdio/HTTP transport modes.

**Write simple functions. Trinity handles the protocol.**

## Features

- **Zero boilerplate** — tools are plain TypeScript files that export a schema and a function
- **Hot reload** — tools update instantly without restarting the server
- **Simple returns** — return primitives, objects, or arrays; Trinity wraps them into MCP format
- **Stdio & HTTP** — works as a VS Code MCP server or as an HTTP endpoint
- **Zod schemas** — type-safe input validation with auto-generated JSON Schema for clients
- **Error handling** — throw errors or return `{ isError: true }` objects, both are handled
- **File watching** — automatically detects new, changed, and deleted tools

## Quick Start

### Install

```bash
bun add @isolo/trinity
```

### Create a tool

Create a `tools/` directory and add a tool file:

```typescript
// tools/hello.ts
import { z } from "zod";

export const description = "Says hello to a person by name";

export const inputSchema = z.object({
  name: z.string().describe("The person's name to greet"),
});

export default async ({ name }: z.infer<typeof inputSchema>) => {
  return `Hello, ${name}!`;
};
```

### Run the server

```bash
# Stdio mode (for VS Code, Claude Desktop, etc.)
bunx @isolo/trinity --target ./tools

# HTTP mode
MCP_MODE=http bunx @isolo/trinity --target ./tools --port 3000
```

## VS Code Integration

Add to `.vscode/mcp.json`:

```jsonc
{
  "servers": {
    "my-tools": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@isolo/trinity", "--target", "./tools"],
    },
  },
}
```

## Tool Structure

Every tool is a `.ts` file with three exports:

| Export        | Type                  | Description                                    |
| ------------- | --------------------- | ---------------------------------------------- |
| `description` | `string`              | What the tool does (shown to LLM)              |
| `inputSchema` | `z.object(...)`       | Zod schema for input validation                |
| `default`     | `async (args) => any` | The function that runs when the tool is called |

### Return Values

Just return what makes sense — Trinity converts it to MCP format automatically:

| You return                        | MCP result                 |
| --------------------------------- | -------------------------- |
| `string`                          | Text content               |
| `number` / `boolean`              | Text content (stringified) |
| `object`                          | Text + structured content  |
| `array`                           | Multiple content items     |
| `{ isError: true, error: "..." }` | Error response             |
| `throw new Error(...)`            | Error response             |

## Examples

### Calculator

```typescript
import { z } from "zod";

export const description = "Performs basic arithmetic operations";

export const inputSchema = z.object({
  operation: z.enum(["add", "subtract", "multiply", "divide"]),
  a: z.number().describe("First operand"),
  b: z.number().describe("Second operand"),
});

export default async ({ operation, a, b }: z.infer<typeof inputSchema>) => {
  switch (operation) {
    case "add":
      return a + b;
    case "subtract":
      return a - b;
    case "multiply":
      return a * b;
    case "divide":
      if (b === 0) return { isError: true, error: "Division by zero" };
      return a / b;
  }
};
```

### Structured Data

```typescript
import { z } from "zod";

export const description = "Returns weather data for a location";

export const inputSchema = z.object({
  location: z.string().describe("City name"),
});

export default async ({ location }: z.infer<typeof inputSchema>) => {
  // Return an object → becomes text + structuredContent in MCP
  return {
    location,
    temperature: 22.5,
    conditions: "Partly cloudy",
    humidity: 65,
  };
};
```

## CLI Options

| Option             | Env Variable | Default              | Description                       |
| ------------------ | ------------ | -------------------- | --------------------------------- |
| `--target <path>`  | —            | _required_           | Folder containing tool files      |
| `--glob <pattern>` | `MCP_GLOB`   | `**/*.ts`            | Glob pattern for tool discovery   |
| `--port <number>`  | —            | `3000`               | HTTP server port                  |
| —                  | `MCP_MODE`   | `stdio`              | Transport mode: `stdio` or `http` |
| —                  | `LOG_FILE`   | `<target>/debug.log` | Log file path                     |

## Development

```bash
# Clone and install
git clone https://github.com/Sujimoshi/trinity.git
cd trinity
bun install

# Run with example tools (watch mode)
bun start

# Run in HTTP mode
bun run start:http
```

## How It Works

1. Trinity scans the `--target` folder for `.ts` files matching `--glob`
2. Each file is dynamically imported — Zod schemas are converted to JSON Schema for MCP
3. When a tool is called, Trinity executes the default export and wraps the return value
4. File watcher detects changes and sends `tools/listChanged` notification to clients
5. In stdio mode, uses MCP stdio transport; in HTTP mode, uses Streamable HTTP on `/mcp`

## License

MIT
