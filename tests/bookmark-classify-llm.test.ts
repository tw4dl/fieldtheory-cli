import test from 'node:test';
import assert from 'node:assert/strict';
import { extractJsonArray, invokeClassifier } from '../src/bookmark-classify-llm.js';

test('Codex classification reads final response and excludes API credentials', async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'fake-test-key';
  try {
    const result = await invokeClassifier({
      name: 'codex', label: 'codex',
      config: {
        bin: process.execPath,
        args: (prompt) => ['-e', `
          const fs = require('node:fs');
          if (process.env.OPENAI_API_KEY) process.exit(7);
          fs.writeFileSync(process.argv[2], '[]');
          console.log('session chatter');
        `, '--', prompt],
      },
    }, 'classify');
    assert.equal(result, '[]');
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test('extractJsonArray: stops at the end of the first balanced JSON array', () => {
  const raw = `Here you go:
[{"id":"1","domains":["ai","finance"],"primary":"ai"}]

Some of [these bookmarks] look ambiguous.`;

  assert.equal(
    extractJsonArray(raw),
    '[{"id":"1","domains":["ai","finance"],"primary":"ai"}]',
  );
});

test('extractJsonArray: skips bracketed prose before the real JSON array', () => {
  const raw = `Status [draft only]
[{"id":"1","domains":["ai"],"primary":"ai"}]`;

  assert.equal(
    extractJsonArray(raw),
    '[{"id":"1","domains":["ai"],"primary":"ai"}]',
  );
});

test('extractJsonArray: ignores brackets inside JSON strings', () => {
  const raw = '[{"id":"1","domains":["ai"],"primary":"ai","note":"keep [this] literal"}] trailing ]';

  assert.equal(
    extractJsonArray(raw),
    '[{"id":"1","domains":["ai"],"primary":"ai","note":"keep [this] literal"}]',
  );
});
