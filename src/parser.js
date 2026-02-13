'use strict';

/**
 * Error parser module - detects and parses various error formats
 */

// Error patterns for different tools
const PATTERNS = {
  // TypeScript: src/file.ts(10,5): error TS2304: Cannot find name 'foo'.
  // Also: src/file.ts:10:5 - error TS2304: Cannot find name 'foo'.
  typescript: {
    regex: /^(.+?)[:(](\d+)[,:](\d+)\)?[: -]+error\s+(TS\d+):\s*(.+)$/gm,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim(),
      type: 'typescript',
    }),
  },

  // ESLint: /path/file.js:10:5: Error message (rule-name)
  // Also:   10:5  error  Message  rule-name
  eslint: {
    regex: /^(?:(.+?):)?(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(\S+)$/gm,
    extract: (match) => ({
      file: match[1] || 'unknown',
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      severity: match[4],
      message: match[5].trim(),
      code: match[6],
      type: 'eslint',
    }),
  },

  // Jest/Vitest: ● Test Suite › test name
  // FAIL src/file.test.ts
  //   ✕ test name (5 ms)
  jest: {
    regex: /^\s*(?:●|✕|✖|FAIL)\s+(.+?)(?:\s+›\s+(.+))?$/gm,
    extract: (match) => ({
      file: match[1].replace(/^FAIL\s+/, ''),
      message: match[2] || match[1],
      type: 'jest',
    }),
    // Additional pattern for assertion errors
    assertionRegex: /^\s*expect\(.+\)\.(.+)$/gm,
  },

  // Python: File "path.py", line 10, in function
  //   SyntaxError: invalid syntax
  python: {
    regex: /^(?:\s*File\s+"(.+?)",\s*line\s*(\d+)(?:,\s*in\s+(\S+))?[\s\S]*?)?^\s*(\w+Error|\w+Exception):\s*(.+)$/gm,
    extract: (match) => ({
      file: match[1] || 'unknown',
      line: match[2] ? parseInt(match[2], 10) : null,
      function: match[3],
      code: match[4],
      message: match[5].trim(),
      type: 'python',
    }),
  },

  // Rust: error[E0425]: cannot find value `x` in this scope
  //  --> src/main.rs:5:13
  rust: {
    regex: /^(error|warning)\[(E\d+)\]:\s*(.+)\n\s*-->\s*(.+?):(\d+):(\d+)/gm,
    extract: (match) => ({
      severity: match[1],
      code: match[2],
      message: match[3].trim(),
      file: match[4],
      line: parseInt(match[5], 10),
      column: parseInt(match[6], 10),
      type: 'rust',
    }),
  },

  // Go: file.go:10:5: error message
  go: {
    regex: /^(.+?\.go):(\d+):(\d+):\s*(.+)$/gm,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      message: match[4].trim(),
      type: 'go',
    }),
  },

  // GCC/Clang: file.c:10:5: error: message
  gcc: {
    regex: /^(.+?\.[ch](?:pp|xx)?):(\d+):(\d+):\s*(error|warning):\s*(.+)$/gm,
    extract: (match) => ({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      severity: match[4],
      message: match[5].trim(),
      type: 'gcc',
    }),
  },

  // Generic: Look for common error patterns
  // [ERROR] message
  // ERROR: message
  // Error: message
  // error: message
  generic: {
    regex: /^(?:\[?(ERROR|Error|error|ERR|FATAL|Fatal|fatal)\]?:?\s*)(.+)$/gm,
    extract: (match) => ({
      severity: match[1].toLowerCase(),
      message: match[2].trim(),
      type: 'generic',
    }),
  },
};

/**
 * Detect the type of errors in the input
 */
function detectType(input) {
  // Check for TypeScript errors
  if (/error\s+TS\d+:/i.test(input)) {
    return 'typescript';
  }

  // Check for ESLint errors (has rule names in parentheses or at end)
  if (/\d+:\d+\s+(error|warning)\s+.+\s+\S+$/m.test(input)) {
    return 'eslint';
  }

  // Check for Jest/Vitest
  if (/^\s*(?:●|✕|✖|FAIL\s+)/m.test(input) || /Test Suites?:.*failed/i.test(input)) {
    return 'jest';
  }

  // Check for Python
  if (/File\s+".+",\s+line\s+\d+/i.test(input) || /\w+Error:|Traceback/i.test(input)) {
    return 'python';
  }

  // Check for Rust
  if (/^(error|warning)\[E\d+\]:/m.test(input)) {
    return 'rust';
  }

  // Check for Go
  if (/\.go:\d+:\d+:/.test(input)) {
    return 'go';
  }

  // Check for GCC/Clang
  if (/\.[ch](pp|xx)?:\d+:\d+:\s*(error|warning):/.test(input)) {
    return 'gcc';
  }

  return 'generic';
}

/**
 * Parse errors from input text
 */
function parseErrors(input, forcedType = 'auto') {
  const type = forcedType === 'auto' ? detectType(input) : forcedType;
  const pattern = PATTERNS[type] || PATTERNS.generic;

  const errors = [];
  let match;

  // Reset regex state
  pattern.regex.lastIndex = 0;

  while ((match = pattern.regex.exec(input)) !== null) {
    try {
      const error = pattern.extract(match);
      error.raw = match[0];
      error.position = match.index;
      errors.push(error);
    } catch {
      // Skip malformed matches
    }
  }

  // If no errors found with specific pattern, try generic
  if (errors.length === 0 && type !== 'generic') {
    return parseErrors(input, 'generic');
  }

  return errors;
}

/**
 * Extract the "signature" of an error for grouping
 * Removes file-specific and line-specific parts
 */
function getErrorSignature(error) {
  let sig = error.message || '';

  // Remove file paths
  sig = sig.replace(/['"`]?(?:\/[\w.-]+)+(?:\/[\w.-]+)?['"`]?/g, '<path>');
  sig = sig.replace(/['"`]?(?:[A-Za-z]:\\[\w.-]+)+(?:\\[\w.-]+)?['"`]?/g, '<path>');

  // Remove line/column numbers
  sig = sig.replace(/\b(?:line|col|column)\s*\d+/gi, '<loc>');
  sig = sig.replace(/:\d+:\d+/g, ':<loc>');

  // Remove specific identifiers (keep structure)
  sig = sig.replace(/['"`]([^'"`]{1,50})['"`]/g, "'<name>'");

  // Remove numbers that look like IDs or indices
  sig = sig.replace(/\b0x[0-9a-f]+\b/gi, '<hex>');
  sig = sig.replace(/\b\d{5,}\b/g, '<id>');

  // Add error code if present
  if (error.code) {
    sig = `[${error.code}] ${sig}`;
  }

  return sig.trim();
}

module.exports = {
  parseErrors,
  detectType,
  getErrorSignature,
  PATTERNS,
};
