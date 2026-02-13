'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { formatOutput, formatText, formatJson, formatMarkdown } = require('../src/formatter.js');

const sampleGroups = [
  {
    signature: "[TS2304] Cannot find name '<name>'",
    count: 5,
    code: 'TS2304',
    type: 'typescript',
    representative: { message: "Cannot find name 'foo'" },
    files: new Set(['a.ts', 'b.ts']),
    errors: [
      { file: 'a.ts', line: 10, column: 5 },
      { file: 'a.ts', line: 20, column: 3 },
      { file: 'b.ts', line: 15, column: 8 },
    ],
  },
  {
    signature: "[TS2339] Property '<name>' does not exist",
    count: 3,
    code: 'TS2339',
    type: 'typescript',
    representative: { message: "Property 'x' does not exist on type 'Y'" },
    files: new Set(['c.ts']),
    errors: [{ file: 'c.ts', line: 5, column: 1 }],
  },
];

const sampleErrors = [
  { file: 'a.ts', line: 10, type: 'typescript', severity: 'error', code: 'TS2304' },
  { file: 'a.ts', line: 20, type: 'typescript', severity: 'error', code: 'TS2304' },
  { file: 'b.ts', line: 15, type: 'typescript', severity: 'error', code: 'TS2304' },
  { file: 'b.ts', line: 25, type: 'typescript', severity: 'error', code: 'TS2304' },
  { file: 'b.ts', line: 35, type: 'typescript', severity: 'error', code: 'TS2304' },
  { file: 'c.ts', line: 5, type: 'typescript', severity: 'error', code: 'TS2339' },
  { file: 'c.ts', line: 15, type: 'typescript', severity: 'error', code: 'TS2339' },
  { file: 'c.ts', line: 25, type: 'typescript', severity: 'error', code: 'TS2339' },
];

describe('formatOutput', () => {
  it('should format as text by default', () => {
    const output = formatOutput(sampleGroups, sampleErrors, { noColor: true });
    assert.ok(output.includes('5×'));
    assert.ok(output.includes('3×'));
  });

  it('should format as JSON', () => {
    const output = formatOutput(sampleGroups, sampleErrors, { format: 'json' });
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.groups.length, 2);
    assert.strictEqual(parsed.summary.totalErrors, 8);
  });

  it('should format as Markdown', () => {
    const output = formatOutput(sampleGroups, sampleErrors, { format: 'markdown' });
    assert.ok(output.includes('# Error Summary'));
    assert.ok(output.includes('## Error Groups'));
  });
});

describe('formatText', () => {
  it('should show error count', () => {
    const output = formatText(sampleGroups, sampleErrors, { noColor: true, quiet: false });
    assert.ok(output.includes('8 errors'));
    assert.ok(output.includes('2 patterns'));
  });

  it('should show numbered groups', () => {
    const output = formatText(sampleGroups, sampleErrors, { noColor: true });
    assert.ok(output.includes('[1]'));
    assert.ok(output.includes('[2]'));
  });

  it('should show locations when requested', () => {
    const output = formatText(sampleGroups, sampleErrors, { noColor: true, locations: true });
    assert.ok(output.includes('Locations:'));
    assert.ok(output.includes('a.ts:10:5'));
  });

  it('should show stats when requested', () => {
    const output = formatText(sampleGroups, sampleErrors, { noColor: true, stats: true });
    assert.ok(output.includes('Summary:'));
    assert.ok(output.includes('Total errors:'));
    assert.ok(output.includes('Unique patterns:'));
  });

  it('should be minimal in quiet mode', () => {
    const output = formatText(sampleGroups, sampleErrors, { noColor: true, quiet: true });
    assert.ok(!output.includes('═'));
    assert.ok(!output.includes('errors in'));
  });
});

describe('formatJson', () => {
  it('should produce valid JSON', () => {
    const output = formatJson(sampleGroups, sampleErrors, {});
    assert.doesNotThrow(() => JSON.parse(output));
  });

  it('should include summary', () => {
    const output = formatJson(sampleGroups, sampleErrors, {});
    const parsed = JSON.parse(output);
    assert.ok(parsed.summary);
    assert.strictEqual(parsed.summary.totalErrors, 8);
    assert.strictEqual(parsed.summary.uniquePatterns, 2);
  });

  it('should include groups with correct counts', () => {
    const output = formatJson(sampleGroups, sampleErrors, {});
    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.groups[0].count, 5);
    assert.strictEqual(parsed.groups[1].count, 3);
  });

  it('should include locations when requested', () => {
    const output = formatJson(sampleGroups, sampleErrors, { locations: true });
    const parsed = JSON.parse(output);
    assert.ok(parsed.groups[0].locations);
    assert.ok(Array.isArray(parsed.groups[0].locations));
  });

  it('should include stats when requested', () => {
    const output = formatJson(sampleGroups, sampleErrors, { stats: true });
    const parsed = JSON.parse(output);
    assert.ok(parsed.stats);
    assert.ok(parsed.stats.byType);
  });
});

describe('formatMarkdown', () => {
  it('should include header', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, {});
    assert.ok(output.includes('# Error Summary'));
  });

  it('should show error count in bold', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, {});
    assert.ok(output.includes('**8 errors**'));
  });

  it('should format groups as sections', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, {});
    assert.ok(output.includes('### 1.'));
    assert.ok(output.includes('### 2.'));
  });

  it('should include code in backticks', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, {});
    assert.ok(output.includes('`TS2304`'));
  });

  it('should include blockquote for message', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, {});
    assert.ok(output.includes('> Cannot find name'));
  });

  it('should include locations when requested', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, { locations: true });
    assert.ok(output.includes('**Locations:**'));
    assert.ok(output.includes('`a.ts:10:5`'));
  });

  it('should include stats table when requested', () => {
    const output = formatMarkdown(sampleGroups, sampleErrors, { stats: true });
    assert.ok(output.includes('## Statistics'));
    assert.ok(output.includes('| Metric | Value |'));
  });
});
