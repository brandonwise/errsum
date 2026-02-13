'use strict';

const { getStats } = require('./grouper.js');

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function c(text, color, opts = {}) {
  if (opts.noColor) return text;
  return `${COLORS[color] || ''}${text}${COLORS.reset}`;
}

/**
 * Format output based on the requested format
 */
function formatOutput(groups, allErrors, opts = {}) {
  switch (opts.format) {
  case 'json':
    return formatJson(groups, allErrors, opts);
  case 'markdown':
  case 'md':
    return formatMarkdown(groups, allErrors, opts);
  default:
    return formatText(groups, allErrors, opts);
  }
}

/**
 * Format as plain text (default)
 */
function formatText(groups, allErrors, opts) {
  const lines = [];

  if (!opts.quiet) {
    const stats = getStats(groups, allErrors);
    lines.push(c('═'.repeat(60), 'dim', opts));
    lines.push(c(`  ${stats.totalErrors} errors`, 'red', opts) +
               c(` in ${stats.uniquePatterns} patterns`, 'dim', opts) +
               c(` across ${stats.filesAffected} files`, 'dim', opts));
    lines.push(c('═'.repeat(60), 'dim', opts));
    lines.push('');
  }

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const num = i + 1;

    // Header
    const countStr = `${group.count}×`;
    lines.push(
      c(`[${num}]`, 'cyan', opts) + ' ' +
      c(countStr, 'bold', opts) + ' ' +
      formatErrorMessage(group.representative, opts)
    );

    // Error code if present
    if (group.code && !opts.quiet) {
      lines.push(c(`    Code: ${group.code}`, 'gray', opts));
    }

    // Show locations if requested
    if (opts.locations && group.files.size > 0) {
      const locations = group.errors
        .filter(e => e.file)
        .slice(0, 5)
        .map(e => {
          let loc = e.file;
          if (e.line) loc += `:${e.line}`;
          if (e.column) loc += `:${e.column}`;
          return loc;
        });

      lines.push(c('    Locations:', 'gray', opts));
      for (const loc of locations) {
        lines.push(c(`      → ${loc}`, 'dim', opts));
      }
      if (group.errors.length > 5) {
        lines.push(c(`      ... and ${group.errors.length - 5} more`, 'dim', opts));
      }
    }

    lines.push('');
  }

  // Stats summary
  if (opts.stats && !opts.quiet) {
    const stats = getStats(groups, allErrors);
    lines.push(c('─'.repeat(60), 'dim', opts));
    lines.push(c('Summary:', 'bold', opts));
    lines.push(`  Total errors:    ${stats.totalErrors}`);
    lines.push(`  Unique patterns: ${stats.uniquePatterns}`);
    lines.push(`  Files affected:  ${stats.filesAffected}`);

    if (Object.keys(stats.byType).length > 1) {
      lines.push('  By type:');
      for (const [type, count] of Object.entries(stats.byType)) {
        lines.push(`    ${type}: ${count}`);
      }
    }

    if (Object.keys(stats.bySeverity).length > 1) {
      lines.push('  By severity:');
      for (const [sev, count] of Object.entries(stats.bySeverity)) {
        const color = sev === 'error' ? 'red' : sev === 'warning' ? 'yellow' : 'dim';
        lines.push(c(`    ${sev}: ${count}`, color, opts));
      }
    }

    if (stats.topCode) {
      lines.push(`  Most common code: ${stats.topCode.code} (${stats.topCode.count}×)`);
    }
  }

  return lines.join('\n');
}

/**
 * Format the error message with highlighting
 */
function formatErrorMessage(error, opts) {
  let msg = error.message || 'Unknown error';

  // Highlight quoted strings
  if (!opts.noColor) {
    msg = msg.replace(/['"`]([^'"`]+)['"`]/g, (_, inner) => {
      return c(`'${inner}'`, 'cyan', opts);
    });
  }

  return msg;
}

/**
 * Format as JSON
 */
function formatJson(groups, allErrors, opts) {
  const stats = getStats(groups, allErrors);

  const output = {
    summary: {
      totalErrors: stats.totalErrors,
      uniquePatterns: stats.uniquePatterns,
      filesAffected: stats.filesAffected,
    },
    groups: groups.map((g) => ({
      count: g.count,
      signature: g.signature,
      code: g.code || null,
      type: g.type,
      message: g.representative.message,
      files: Array.from(g.files),
      locations: opts.locations
        ? g.errors.map((e) => ({
          file: e.file,
          line: e.line,
          column: e.column,
        }))
        : undefined,
    })),
  };

  if (opts.stats) {
    output.stats = stats;
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Format as Markdown
 */
function formatMarkdown(groups, allErrors, opts) {
  const stats = getStats(groups, allErrors);
  const lines = [];

  lines.push('# Error Summary');
  lines.push('');
  lines.push(`**${stats.totalErrors} errors** in ${stats.uniquePatterns} patterns across ${stats.filesAffected} files`);
  lines.push('');
  lines.push('## Error Groups');
  lines.push('');

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const num = i + 1;

    lines.push(`### ${num}. \`${group.code || 'Error'}\` (${group.count}×)`);
    lines.push('');
    lines.push(`> ${group.representative.message}`);
    lines.push('');

    if (opts.locations && group.files.size > 0) {
      lines.push('**Locations:**');
      const locations = group.errors.filter(e => e.file).slice(0, 10);
      for (const e of locations) {
        let loc = `- \`${e.file}`;
        if (e.line) loc += `:${e.line}`;
        if (e.column) loc += `:${e.column}`;
        loc += '`';
        lines.push(loc);
      }
      if (group.errors.length > 10) {
        lines.push(`- ... and ${group.errors.length - 10} more`);
      }
      lines.push('');
    }
  }

  if (opts.stats) {
    lines.push('## Statistics');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total errors | ${stats.totalErrors} |`);
    lines.push(`| Unique patterns | ${stats.uniquePatterns} |`);
    lines.push(`| Files affected | ${stats.filesAffected} |`);

    if (stats.topCode) {
      lines.push(`| Most common code | ${stats.topCode.code} (${stats.topCode.count}×) |`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  formatOutput,
  formatText,
  formatJson,
  formatMarkdown,
  COLORS,
};
