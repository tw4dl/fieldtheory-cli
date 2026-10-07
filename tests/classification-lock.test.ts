import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readClassificationLock, withClassificationLock } from '../src/classification-lock.js';
import { formatBookmarkStatus, formatBookmarkSummary } from '../src/bookmarks-service.js';

test('bookmark status and summary expose the active classification job', () => {
  const view = {
    connected: false, bookmarkCount: 3, classificationTotal: 3,
    categoriesDone: 2, domainsDone: 1, lastUpdated: null, mode: 'GraphQL', cachePath: '/tmp/cache',
    classificationEngine: 'codex', classifierAccess: ['codex'],
    classificationJob: { pid: 123, kind: 'classify' as const, startedAt: '2026-10-08T00:00:00Z' },
  };
  assert.match(formatBookmarkStatus(view), /classification: running \(classify, pid 123, 50\/batch\)/);
  assert.match(formatBookmarkSummary(view), /classification=classify:123:50/);
});

test('classification lock rejects overlap and cleans up after failure', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-lock-'));
  const previous = process.env.FT_DATA_DIR;
  process.env.FT_DATA_DIR = dir;
  try {
    assert.equal(readClassificationLock(), null);
    await assert.rejects(withClassificationLock('classify', async () => {
      assert.equal(readClassificationLock()?.kind, 'classify');
      await assert.rejects(withClassificationLock('classify-domains', async () => {}), /already running/);
      throw new Error('batch failed');
    }), /batch failed/);
    assert.equal(readClassificationLock(), null);
    fs.writeFileSync(path.join(dir, 'classification-lock.json'), 'invalid');
    await withClassificationLock('classify-domains', async () => {
      assert.equal(readClassificationLock()?.kind, 'classify-domains');
    });
    assert.equal(readClassificationLock(), null);
  } finally {
    if (previous === undefined) delete process.env.FT_DATA_DIR;
    else process.env.FT_DATA_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
