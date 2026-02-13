# errsum

Error output summarizer — parse build/lint/test output, group similar errors, and show unique patterns with counts.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

## Why?

When a build fails with 500+ errors, most are variations of the same issue. `errsum` groups similar errors together so you can:

- **Quickly understand** the scope of the problem
- **Prioritize fixes** by seeing which errors occur most often
- **Feed AI agents** concise summaries instead of walls of text
- **Track progress** as you fix issues

## Installation

```bash
npm install -g errsum
```

## Usage

```bash
# Pipe command output
npm run build 2>&1 | errsum

# Read from file
errsum build.log

# Run a command and analyze
errsum -- tsc --noEmit

# Show top 5 errors with locations
errsum -n 5 --locations build.log

# Output as JSON for scripting
errsum -f json build.log

# Show statistics
errsum --stats build.log
```

## Supported Error Formats

`errsum` auto-detects and parses errors from:

| Format | Example |
|--------|---------|
| **TypeScript** | `src/file.ts(10,5): error TS2304: Cannot find name 'x'.` |
| **ESLint** | `10:5  error  Unexpected var  no-var` |
| **Jest/Vitest** | `● Test Suite › should work` |
| **Python** | `File "test.py", line 10\n  SyntaxError: invalid syntax` |
| **Rust** | `error[E0425]: cannot find value 'x' --> src/main.rs:5:13` |
| **Go** | `main.go:10:5: undefined: x` |
| **GCC/Clang** | `main.c:10:5: error: 'x' undeclared` |
| **Generic** | `[ERROR] Something went wrong` |

## Options

```
-n, --top <n>      Show top N error groups (default: 10, 0 = all)
-f, --format <fmt> Output format: text, json, markdown (default: text)
-t, --type <type>  Force error type (auto, typescript, eslint, etc.)
-l, --locations    Show file:line locations for each error
-c, --context <n>  Show N lines of context around errors
-s, --stats        Show statistics summary
-q, --quiet        Only show error patterns, no decoration
--no-color         Disable colored output
-h, --help         Show help
-v, --version      Show version
```

## Examples

### Basic Usage

```bash
$ npm run build 2>&1 | errsum

════════════════════════════════════════════════════════════
  47 errors in 8 patterns across 12 files
════════════════════════════════════════════════════════════

[1] 15× Cannot find name 'x'
    Code: TS2304

[2] 12× Property 'y' does not exist on type 'Z'
    Code: TS2339

[3] 8× Argument of type 'A' is not assignable to parameter of type 'B'
    Code: TS2345
```

### With Locations

```bash
$ errsum -l build.log

[1] 15× Cannot find name 'x'
    Code: TS2304
    Locations:
      → src/utils.ts:10:5
      → src/utils.ts:25:3
      → src/helpers.ts:8:12
      → src/index.ts:100:7
      → src/index.ts:150:3
      ... and 10 more
```

### JSON Output

```bash
$ errsum -f json build.log | jq '.groups[0]'
{
  "count": 15,
  "signature": "[TS2304] Cannot find name '<name>'",
  "code": "TS2304",
  "type": "typescript",
  "message": "Cannot find name 'x'",
  "files": ["src/utils.ts", "src/helpers.ts", "src/index.ts"]
}
```

### Markdown Output

```bash
$ errsum -f markdown --stats build.log > ERRORS.md
```

### Use with AI Agents

```bash
# Get a concise summary for Claude/GPT
errsum -n 5 -q build.log | claude "Fix these TypeScript errors"

# Or as JSON for structured processing
errsum -f json build.log | jq '.groups | map(.message)'
```

## How Grouping Works

Errors are grouped by a "signature" that normalizes:

- File paths → `<path>`
- Line/column numbers → `<loc>`
- Quoted identifiers → `'<name>'`
- Large numbers/IDs → `<id>`

This means `Cannot find name 'foo'` and `Cannot find name 'bar'` are grouped together, as they're the same type of error.

## Exit Codes

- `0` — No errors found
- `1` — Errors were found and summarized

## Development

```bash
# Clone
git clone https://github.com/brandonwise/errsum.git
cd errsum

# Install dev dependencies
npm install

# Run tests
npm test

# Run linter
npm run lint

# Run all checks
npm run check
```

## License

MIT © Brandon Wise
