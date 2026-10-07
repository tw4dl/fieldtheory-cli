import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { attachStderrToError, buildEngineArgs, readClassificationLock, withClassificationLock } from '../src/bookmark-classify-llm.js';

test('buildEngineArgs adds skip-git-repo-check for codex', () => {
  assert.deepEqual(
    buildEngineArgs('codex', 'Return ONLY []'),
    ['exec', '--skip-git-repo-check', '--model', 'gpt-5.4-mini', '--config', 'model_reasoning_effort="low"', 'Return ONLY []'],
  );
});

test('buildEngineArgs preserves claude invocation shape', () => {
  assert.deepEqual(
    buildEngineArgs('claude', 'Return ONLY []'),
    ['-p', '--output-format', 'text', 'Return ONLY []'],
  );
});

test('buildEngineArgs respects FT_CODEX_MODEL override', () => {
  process.env.FT_CODEX_MODEL = 'gpt-5.4';

  try {
    assert.deepEqual(
      buildEngineArgs('codex', 'Return ONLY []'),
      ['exec', '--skip-git-repo-check', '--model', 'gpt-5.4', '--config', 'model_reasoning_effort="low"', 'Return ONLY []'],
    );
  } finally {
    delete process.env.FT_CODEX_MODEL;
  }
});

test('attachStderrToError appends child stderr text', () => {
  const error = Object.assign(new Error('Command failed: codex exec prompt'), {
    stderr: 'Not inside a trusted directory and --skip-git-repo-check was not specified.\n',
  });

  const result = attachStderrToError(error);

  assert.equal(
    result.message,
    'Command failed: codex exec prompt\nNot inside a trusted directory and --skip-git-repo-check was not specified.',
  );
});

test('attachStderrToError leaves errors without stderr unchanged', () => {
  const error = new Error('Command failed');
  const result = attachStderrToError(error);

  assert.equal(result.message, 'Command failed');
});

test('withClassificationLock writes and clears a live lock file', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-lock-'));
  process.env.FT_DATA_DIR = tmpDir;

  try {
    assert.equal(readClassificationLock(), null);

    const result = await withClassificationLock('classify-domains', async () => {
      const lock = readClassificationLock();
      assert.equal(lock?.kind, 'classify-domains');
      assert.equal(lock?.pid, process.pid);
      return 'ok';
    });

    assert.equal(result, 'ok');
    assert.equal(readClassificationLock(), null);
  } finally {
    delete process.env.FT_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('withClassificationLock rejects a second concurrent classify run', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-lock-'));
  process.env.FT_DATA_DIR = tmpDir;

  try {
    await assert.rejects(
      () => withClassificationLock('classify', async () => withClassificationLock('classify-domains', async () => 'nope')),
      /Classification already running \(classify, pid \d+\)/,
    );
  } finally {
    delete process.env.FT_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
