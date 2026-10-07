import test from 'node:test';
import assert from 'node:assert/strict';
import { formatBookmarkStatus, formatBookmarkSummary } from '../src/bookmarks-service.js';

test('formatBookmarkStatus produces human-readable summary', () => {
  const text = formatBookmarkStatus({
    connected: true,
    bookmarkCount: 99,
    categoriesDone: 12,
    domainsDone: 34,
    classificationEngine: 'codex',
    classifierAccess: { claude: false, codex: true },
    codexModel: 'gpt-5.4-mini',
    classificationJob: { pid: 17169, kind: 'classify-domains', batchSize: 50 },
    lastUpdated: '2026-03-28T17:23:00Z',
    mode: 'Incremental by default (GraphQL + API available)',
    cachePath: '/tmp/x-bookmarks.jsonl',
  });

  assert.match(text, /^Bookmarks/);
  assert.match(text, /bookmarks: 99/);
  assert.match(text, /categories: 12\/99/);
  assert.match(text, /domains: 34\/99/);
  assert.match(text, /classifier: codex \(gpt-5\.4-mini\)/);
  assert.match(text, /agent access: claude=no, codex=yes/);
  assert.match(text, /classification: running \(classify-domains, pid 17169, 50\/batch\)/);
  assert.match(text, /last updated: 2026-03-28T17:23:00Z/);
  assert.match(text, /sync mode: Incremental by default \(GraphQL \+ API available\)/);
  assert.match(text, /cache: \/tmp\/x-bookmarks\.jsonl/);
  assert.doesNotMatch(text, /dataset/);
});

test('formatBookmarkStatus shows never when no lastUpdated', () => {
  const text = formatBookmarkStatus({
    connected: false,
    bookmarkCount: 0,
    categoriesDone: 0,
    domainsDone: 0,
    classificationEngine: 'none',
    classifierAccess: { claude: false, codex: false },
    codexModel: 'gpt-5.4-mini',
    classificationJob: null,
    lastUpdated: null,
    mode: 'Incremental by default (GraphQL)',
    cachePath: '/tmp/x-bookmarks.jsonl',
  });

  assert.match(text, /last updated: never/);
});

test('formatBookmarkSummary produces concise operator-friendly output', () => {
  const text = formatBookmarkSummary({
    connected: true,
    bookmarkCount: 99,
    categoriesDone: 12,
    domainsDone: 34,
    classificationEngine: 'codex',
    classifierAccess: { claude: false, codex: true },
    codexModel: 'gpt-5.4-mini',
    classificationJob: { pid: 17169, kind: 'classify-domains', batchSize: 50 },
    lastUpdated: '2026-03-28T17:23:00Z',
    mode: 'API sync',
    cachePath: '/tmp/x-bookmarks.jsonl',
  });

  assert.match(text, /bookmarks=99/);
  assert.match(text, /categories=12\/99/);
  assert.match(text, /domains=34\/99/);
  assert.match(text, /classifier=codex:gpt-5\.4-mini/);
  assert.match(text, /access=claude:no,codex:yes/);
  assert.match(text, /classification=classify-domains:17169:50/);
  assert.match(text, /updated=2026-03-28T17:23:00Z/);
  assert.match(text, /mode="API sync"/);
});
