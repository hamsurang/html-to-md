const { describe, it } = require('node:test');
const assert = require('node:assert');

// Import source directly (pure functions, no browser APIs)
// We re-implement here since the source uses ESM exports
function normalizeWhitespace(markdown) {
  return markdown
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n[ \t]+\n/g, '\n\n')
    .trim();
}

function stripUnicodeDecoration(markdown) {
  return markdown
    .replace(/[\u2500-\u257F]/g, '')
    .replace(/[\u2700-\u27BF]/g, '')
    .replace(/[★☆●○◆◇▶►▼▲■□▪▫◈◉✦✧✪✫✬✭✮✯✰]/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

function postProcess(markdown) {
  return stripUnicodeDecoration(normalizeWhitespace(markdown));
}

describe('normalizeWhitespace', () => {
  it('should collapse 3+ newlines to 2', () => {
    assert.strictEqual(normalizeWhitespace('a\n\n\n\nb'), 'a\n\nb');
  });

  it('should remove trailing whitespace', () => {
    assert.strictEqual(normalizeWhitespace('hello   \nworld  '), 'hello\nworld');
  });

  it('should remove blank lines with only whitespace', () => {
    assert.strictEqual(normalizeWhitespace('a\n   \nb'), 'a\n\nb');
  });

  it('should trim leading/trailing whitespace', () => {
    assert.strictEqual(normalizeWhitespace('  \n\nhello\n\n  '), 'hello');
  });

  it('should handle empty input', () => {
    assert.strictEqual(normalizeWhitespace(''), '');
  });
});

describe('stripUnicodeDecoration', () => {
  it('should remove box-drawing characters', () => {
    assert.strictEqual(stripUnicodeDecoration('hello ─── world'), 'hello  world');
  });

  it('should remove decorative symbols', () => {
    assert.strictEqual(stripUnicodeDecoration('★ Title ★'), ' Title ');
  });

  it('should preserve normal text', () => {
    assert.strictEqual(stripUnicodeDecoration('Hello World'), 'Hello World');
  });
});

describe('postProcess', () => {
  it('should apply both normalizations', () => {
    const input = '★ Title ★\n\n\n\nContent   \n\n\n\n───';
    const result = postProcess(input);
    assert.ok(!result.includes('★'));
    assert.ok(!result.includes('───'));
    assert.ok(!result.includes('\n\n\n'));
  });

  it('should handle typical markdown output', () => {
    const input = '# Title\n\nParagraph 1\n\n\n\nParagraph 2\n\n';
    const result = postProcess(input);
    assert.strictEqual(result, '# Title\n\nParagraph 1\n\nParagraph 2');
  });
});
