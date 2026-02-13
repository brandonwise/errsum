'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { groupErrors, similarity, mergeSimilarGroups, getStats } = require('../src/grouper.js');

describe('groupErrors', () => {
  it('should group identical errors together', () => {
    const errors = [
      { message: "Cannot find name 'x'", file: 'a.ts', code: 'TS2304' },
      { message: "Cannot find name 'x'", file: 'b.ts', code: 'TS2304' },
      { message: "Cannot find name 'x'", file: 'c.ts', code: 'TS2304' },
    ];

    const groups = groupErrors(errors);
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].count, 3);
    assert.strictEqual(groups[0].files.size, 3);
  });

  it('should group similar errors with different identifiers', () => {
    const errors = [
      { message: "Cannot find name 'foo'", file: 'a.ts', code: 'TS2304' },
      { message: "Cannot find name 'bar'", file: 'b.ts', code: 'TS2304' },
    ];

    const groups = groupErrors(errors);
    // These should be grouped because the signature normalizes quoted names
    assert.strictEqual(groups.length, 1);
    assert.strictEqual(groups[0].count, 2);
  });

  it('should separate different error types', () => {
    const errors = [
      { message: "Cannot find name 'x'", code: 'TS2304' },
      { message: 'Property does not exist', code: 'TS2339' },
    ];

    const groups = groupErrors(errors);
    assert.strictEqual(groups.length, 2);
  });

  it('should sort groups by count descending', () => {
    const errors = [
      { message: 'Error A' },
      { message: 'Error B' },
      { message: 'Error B' },
      { message: 'Error B' },
      { message: 'Error A' },
    ];

    const groups = groupErrors(errors);
    assert.strictEqual(groups[0].count, 3); // Error B
    assert.strictEqual(groups[1].count, 2); // Error A
  });

  it('should limit to top N groups', () => {
    const errors = Array.from({ length: 100 }, (_, i) => ({
      message: `Error ${i % 20}`,
    }));

    const groups = groupErrors(errors, { top: 5 });
    assert.strictEqual(groups.length, 5);
  });
});

describe('similarity', () => {
  it('should return 1 for identical strings', () => {
    assert.strictEqual(similarity('hello world', 'hello world'), 1);
  });

  it('should return 0 for completely different strings', () => {
    const sim = similarity('abc', 'xyz');
    assert.strictEqual(sim, 0);
  });

  it('should return high similarity for similar strings', () => {
    const sim = similarity(
      'Cannot find module foo',
      'Cannot find module bar'
    );
    assert.ok(sim > 0.5);
  });

  it('should handle empty strings', () => {
    // Two identical empty strings return 1 (equal check)
    assert.strictEqual(similarity('', ''), 1);
    // One empty, one non-empty returns 0
    assert.strictEqual(similarity('hello', ''), 0);
    assert.strictEqual(similarity('', 'hello'), 0);
  });
});

describe('mergeSimilarGroups', () => {
  it('should merge groups with high similarity', () => {
    const groups = [
      { signature: 'Cannot find foo', count: 2, errors: [{}, {}], files: new Set(['a.ts']) },
      { signature: 'Cannot find bar', count: 3, errors: [{}, {}, {}], files: new Set(['b.ts']) },
    ];

    const merged = mergeSimilarGroups(groups, 0.5);
    assert.strictEqual(merged.length, 1);
    assert.strictEqual(merged[0].count, 5);
    assert.strictEqual(merged[0].files.size, 2);
  });

  it('should not merge groups with low similarity', () => {
    const groups = [
      { signature: 'Type error in function', count: 2, errors: [{}, {}], files: new Set() },
      { signature: 'Syntax error at line', count: 3, errors: [{}, {}, {}], files: new Set() },
    ];

    const merged = mergeSimilarGroups(groups, 0.9);
    assert.strictEqual(merged.length, 2);
  });
});

describe('getStats', () => {
  it('should calculate total errors', () => {
    const errors = [{}, {}, {}];
    const groups = [];

    const stats = getStats(groups, errors);
    assert.strictEqual(stats.totalErrors, 3);
  });

  it('should count unique files', () => {
    const errors = [
      { file: 'a.ts' },
      { file: 'a.ts' },
      { file: 'b.ts' },
      { file: 'c.ts' },
    ];

    const stats = getStats([], errors);
    assert.strictEqual(stats.filesAffected, 3);
  });

  it('should count by type', () => {
    const errors = [
      { type: 'typescript' },
      { type: 'typescript' },
      { type: 'eslint' },
    ];

    const stats = getStats([], errors);
    assert.strictEqual(stats.byType.typescript, 2);
    assert.strictEqual(stats.byType.eslint, 1);
  });

  it('should count by severity', () => {
    const errors = [
      { severity: 'error' },
      { severity: 'error' },
      { severity: 'warning' },
    ];

    const stats = getStats([], errors);
    assert.strictEqual(stats.bySeverity.error, 2);
    assert.strictEqual(stats.bySeverity.warning, 1);
  });

  it('should find most common error code', () => {
    const errors = [
      { code: 'TS2304' },
      { code: 'TS2304' },
      { code: 'TS2304' },
      { code: 'TS2339' },
    ];

    const stats = getStats([], errors);
    assert.strictEqual(stats.topCode.code, 'TS2304');
    assert.strictEqual(stats.topCode.count, 3);
  });
});
