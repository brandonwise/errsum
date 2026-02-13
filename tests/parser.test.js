'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { parseErrors, detectType, getErrorSignature } = require('../src/parser.js');

describe('detectType', () => {
  it('should detect TypeScript errors', () => {
    const input = 'src/file.ts(10,5): error TS2304: Cannot find name \'foo\'.';
    assert.strictEqual(detectType(input), 'typescript');
  });

  it('should detect ESLint errors', () => {
    const input = '10:5  error  Unexpected var  no-var';
    assert.strictEqual(detectType(input), 'eslint');
  });

  it('should detect Jest errors', () => {
    const input = '● Test Suite › should do something';
    assert.strictEqual(detectType(input), 'jest');
  });

  it('should detect Python errors', () => {
    const input = 'File "test.py", line 10, in <module>\n  SyntaxError: invalid syntax';
    assert.strictEqual(detectType(input), 'python');
  });

  it('should detect Rust errors', () => {
    const input = 'error[E0425]: cannot find value `x` in this scope\n --> src/main.rs:5:13';
    assert.strictEqual(detectType(input), 'rust');
  });

  it('should detect Go errors', () => {
    const input = 'main.go:10:5: undefined: x';
    assert.strictEqual(detectType(input), 'go');
  });

  it('should detect GCC errors', () => {
    const input = 'main.c:10:5: error: \'x\' undeclared';
    assert.strictEqual(detectType(input), 'gcc');
  });

  it('should fallback to generic', () => {
    const input = 'Something went wrong';
    assert.strictEqual(detectType(input), 'generic');
  });
});

describe('parseErrors', () => {
  describe('TypeScript', () => {
    it('should parse TypeScript errors with parentheses format', () => {
      const input = `src/utils.ts(10,5): error TS2304: Cannot find name 'foo'.
src/utils.ts(20,3): error TS2304: Cannot find name 'bar'.`;

      const errors = parseErrors(input, 'typescript');
      assert.strictEqual(errors.length, 2);
      assert.strictEqual(errors[0].file, 'src/utils.ts');
      assert.strictEqual(errors[0].line, 10);
      assert.strictEqual(errors[0].column, 5);
      assert.strictEqual(errors[0].code, 'TS2304');
      assert.strictEqual(errors[0].message, "Cannot find name 'foo'.");
    });

    it('should parse TypeScript errors with colon format', () => {
      const input = 'src/index.ts:15:10 - error TS2339: Property \'x\' does not exist.';
      const errors = parseErrors(input, 'typescript');
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].line, 15);
      assert.strictEqual(errors[0].code, 'TS2339');
    });
  });

  describe('ESLint', () => {
    it('should parse ESLint errors', () => {
      const input = `5:10  error  Unexpected var, use let or const instead  no-var
10:1  warning  Missing semicolon  semi`;

      const errors = parseErrors(input, 'eslint');
      assert.strictEqual(errors.length, 2);
      assert.strictEqual(errors[0].line, 5);
      assert.strictEqual(errors[0].severity, 'error');
      assert.strictEqual(errors[0].code, 'no-var');
      assert.strictEqual(errors[1].severity, 'warning');
    });
  });

  describe('Python', () => {
    it('should parse Python errors', () => {
      const input = `Traceback (most recent call last):
  File "test.py", line 10, in main
NameError: name 'undefined_var' is not defined`;

      const errors = parseErrors(input, 'python');
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].code, 'NameError');
    });
  });

  describe('Rust', () => {
    it('should parse Rust errors', () => {
      const input = `error[E0425]: cannot find value \`x\` in this scope
 --> src/main.rs:5:13`;

      const errors = parseErrors(input, 'rust');
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].code, 'E0425');
      assert.strictEqual(errors[0].file, 'src/main.rs');
      assert.strictEqual(errors[0].line, 5);
    });
  });

  describe('Go', () => {
    it('should parse Go errors', () => {
      const input = `main.go:10:5: undefined: someVar
utils.go:20:10: syntax error: unexpected token`;

      const errors = parseErrors(input, 'go');
      assert.strictEqual(errors.length, 2);
      assert.strictEqual(errors[0].file, 'main.go');
      assert.strictEqual(errors[0].line, 10);
    });
  });

  describe('Generic', () => {
    it('should parse generic ERROR messages', () => {
      const input = `[ERROR] Something went wrong
Error: Another problem
error: lowercase error`;

      const errors = parseErrors(input, 'generic');
      assert.strictEqual(errors.length, 3);
    });
  });

  describe('Auto-detection', () => {
    it('should auto-detect TypeScript', () => {
      const input = 'src/file.ts(10,5): error TS2304: Cannot find name \'x\'.';
      const errors = parseErrors(input, 'auto');
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].type, 'typescript');
    });

    it('should fallback to generic if specific parser fails', () => {
      const input = '[ERROR] Something completely different';
      const errors = parseErrors(input, 'auto');
      assert.strictEqual(errors.length, 1);
      assert.strictEqual(errors[0].type, 'generic');
    });
  });
});

describe('getErrorSignature', () => {
  it('should normalize file paths', () => {
    const error1 = { message: "Cannot find '/path/to/file.ts'" };
    const error2 = { message: "Cannot find '/other/path/file.ts'" };

    const sig1 = getErrorSignature(error1);
    const sig2 = getErrorSignature(error2);

    assert.strictEqual(sig1, sig2);
  });

  it('should normalize line numbers', () => {
    const error1 = { message: 'Error at line 10' };
    const error2 = { message: 'Error at line 999' };

    const sig1 = getErrorSignature(error1);
    const sig2 = getErrorSignature(error2);

    assert.strictEqual(sig1, sig2);
  });

  it('should normalize quoted identifiers', () => {
    const error1 = { message: "Cannot find name 'foo'" };
    const error2 = { message: "Cannot find name 'bar'" };

    const sig1 = getErrorSignature(error1);
    const sig2 = getErrorSignature(error2);

    assert.strictEqual(sig1, sig2);
  });

  it('should include error code in signature', () => {
    const error = { code: 'TS2304', message: 'Cannot find name' };
    const sig = getErrorSignature(error);

    assert.ok(sig.includes('[TS2304]'));
  });
});
