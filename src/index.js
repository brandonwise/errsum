#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const fs = require('node:fs');
const { parseErrors } = require('./parser.js');
const { groupErrors } = require('./grouper.js');
const { formatOutput } = require('./formatter.js');

const VERSION = '1.0.0';

const HELP = `
errsum v${VERSION} - Error output summarizer

Usage:
  errsum [options] [file]        Read from file
  command | errsum [options]     Read from stdin
  errsum [options] -- command    Run command and analyze output

Options:
  -n, --top <n>      Show top N error groups (default: 10, 0 = all)
  -f, --format <fmt> Output format: text, json, markdown (default: text)
  -t, --type <type>  Force error type: auto, typescript, eslint, jest,
                     python, rust, go, generic (default: auto)
  -l, --locations    Show file:line locations for each error
  -c, --context <n>  Show N lines of context around errors (default: 0)
  -s, --stats        Show statistics summary
  -q, --quiet        Only show error patterns, no decoration
  --no-color         Disable colored output
  -h, --help         Show this help
  -v, --version      Show version

Examples:
  npm run build 2>&1 | errsum
  errsum build.log
  errsum -n 5 --stats build.log
  errsum -f json -- tsc --noEmit
  eslint . 2>&1 | errsum -t eslint --locations

Supported error formats:
  • TypeScript (tsc)     • ESLint
  • Jest/Vitest          • Python
  • Rust (cargo)         • Go
  • GCC/Clang            • Generic (fallback)
`;

function parseCliArgs() {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: {
        top: { type: 'string', short: 'n', default: '10' },
        format: { type: 'string', short: 'f', default: 'text' },
        type: { type: 'string', short: 't', default: 'auto' },
        locations: { type: 'boolean', short: 'l', default: false },
        context: { type: 'string', short: 'c', default: '0' },
        stats: { type: 'boolean', short: 's', default: false },
        quiet: { type: 'boolean', short: 'q', default: false },
        'no-color': { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
        version: { type: 'boolean', short: 'v', default: false },
      },
    });

    return {
      top: parseInt(values.top, 10) || 10,
      format: values.format,
      type: values.type,
      locations: values.locations,
      context: parseInt(values.context, 10) || 0,
      stats: values.stats,
      quiet: values.quiet,
      noColor: values['no-color'] || !process.stdout.isTTY,
      help: values.help,
      version: values.version,
      positionals,
    };
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function readInput(positionals) {
  // Check if reading from stdin
  if (!process.stdin.isTTY && positionals.length === 0) {
    return readStdin();
  }

  // Check for -- command execution
  const dashIndex = process.argv.indexOf('--');
  if (dashIndex !== -1 && dashIndex < process.argv.length - 1) {
    const command = process.argv.slice(dashIndex + 1).join(' ');
    return runCommand(command);
  }

  // Read from file
  if (positionals.length > 0) {
    const file = positionals[0];
    if (!fs.existsSync(file)) {
      console.error(`Error: File not found: ${file}`);
      process.exit(1);
    }
    return fs.readFileSync(file, 'utf8');
  }

  // No input
  console.error('Error: No input provided. Use --help for usage.');
  process.exit(1);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function runCommand(command) {
  return new Promise((resolve) => {
    const { spawn } = require('node:child_process');
    const proc = spawn(command, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });

    let output = '';
    proc.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    proc.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });

    proc.on('close', () => {
      console.log('\n--- errsum analysis ---\n');
      resolve(output);
    });
  });
}

async function main() {
  const opts = parseCliArgs();

  if (opts.help) {
    console.log(HELP);
    process.exit(0);
  }

  if (opts.version) {
    console.log(`errsum v${VERSION}`);
    process.exit(0);
  }

  const input = await readInput(opts.positionals);

  if (!input || input.trim().length === 0) {
    if (!opts.quiet) {
      console.log('No input to analyze.');
    }
    process.exit(0);
  }

  const errors = parseErrors(input, opts.type);

  if (errors.length === 0) {
    if (!opts.quiet) {
      console.log('No errors found in input.');
    }
    process.exit(0);
  }

  const groups = groupErrors(errors, opts);
  const output = formatOutput(groups, errors, opts);

  console.log(output);

  // Exit with error code if errors were found
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
