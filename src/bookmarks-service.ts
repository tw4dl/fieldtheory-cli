import { getTwitterBookmarksStatus } from './bookmarks.js';
import { buildIndex, getClassificationProgress } from './bookmarks-db.js';
import { CLASSIFICATION_BATCH_SIZE, configuredCodexModel, detectEngine, hasEngine, readClassificationLock } from './bookmark-classify-llm.js';
import { loadTwitterOAuthToken } from './xauth.js';
import { syncBookmarksGraphQL, type SyncProgress } from './graphql-bookmarks.js';

export interface BookmarkEnableResult {
  synced: boolean;
  bookmarkCount: number;
  indexedCount: number;
  cachePath: string;
  messageLines: string[];
}

export interface BookmarkStatusView {
  connected: boolean;
  bookmarkCount: number;
  categoriesDone: number;
  domainsDone: number;
  classificationEngine: 'claude' | 'codex' | 'none';
  classifierAccess: { claude: boolean; codex: boolean };
  codexModel: string;
  classificationJob: { pid: number; kind: 'classify' | 'classify-domains'; batchSize: number } | null;
  lastUpdated: string | null;
  mode: string;
  cachePath: string;
}

export async function enableBookmarks(): Promise<BookmarkEnableResult> {
  const syncResult = await syncBookmarksGraphQL({
    onProgress: (status: SyncProgress) => {
      if (status.page % 25 === 0 || status.done) {
        process.stderr.write(
          `\r[sync] page ${status.page} | ${status.totalFetched} fetched | ${status.newAdded} new${status.done ? ` | ${status.stopReason}\n` : ''}`
        );
      }
    },
  });

  const indexResult = await buildIndex();

  return {
    synced: true,
    bookmarkCount: syncResult.totalBookmarks,
    indexedCount: indexResult.recordCount,
    cachePath: syncResult.cachePath,
    messageLines: [
      'Bookmarks enabled.',
      `- sync completed: ${syncResult.totalBookmarks} bookmarks (${syncResult.added} new)`,
      `- indexed: ${indexResult.recordCount} records → ${indexResult.dbPath}`,
      `- cache: ${syncResult.cachePath}`,
    ],
  };
}

export async function getBookmarkStatusView(): Promise<BookmarkStatusView> {
  const token = await loadTwitterOAuthToken();
  const status = await getTwitterBookmarksStatus();
  const progress = await getClassificationProgress();
  return {
    connected: Boolean(token?.access_token),
    bookmarkCount: status.totalBookmarks,
    categoriesDone: progress.categoriesDone,
    domainsDone: progress.domainsDone,
    classificationEngine: detectEngine() ?? 'none',
    classifierAccess: {
      claude: hasEngine('claude'),
      codex: hasEngine('codex'),
    },
    codexModel: configuredCodexModel(),
    classificationJob: (() => {
      const lock = readClassificationLock();
      if (!lock) return null;
      return {
        pid: lock.pid,
        kind: lock.kind,
        batchSize: CLASSIFICATION_BATCH_SIZE,
      };
    })(),
    lastUpdated: status.lastIncrementalSyncAt ?? status.lastFullSyncAt ?? null,
    mode: token?.access_token ? 'Incremental by default (GraphQL + API available)' : 'Incremental by default (GraphQL)',
    cachePath: status.cachePath,
  };
}

export function formatBookmarkStatus(view: BookmarkStatusView): string {
  return [
    'Bookmarks',
    `  bookmarks: ${view.bookmarkCount}`,
    `  categories: ${view.categoriesDone}/${view.bookmarkCount}`,
    `  domains: ${view.domainsDone}/${view.bookmarkCount}`,
    `  classifier: ${view.classificationEngine}${view.classificationEngine === 'codex' ? ` (${view.codexModel})` : ''}`,
    `  agent access: claude=${view.classifierAccess.claude ? 'yes' : 'no'}, codex=${view.classifierAccess.codex ? 'yes' : 'no'}`,
    ...(view.classificationJob
      ? [`  classification: running (${view.classificationJob.kind}, pid ${view.classificationJob.pid}, ${view.classificationJob.batchSize}/batch)`]
      : []),
    `  last updated: ${view.lastUpdated ?? 'never'}`,
    `  sync mode: ${view.mode}`,
    `  cache: ${view.cachePath}`,
  ].join('\n');
}

export function formatBookmarkSummary(view: BookmarkStatusView): string {
  const classification = view.classificationJob
    ? ` classification=${view.classificationJob.kind}:${view.classificationJob.pid}:${view.classificationJob.batchSize}`
    : '';
  return `bookmarks=${view.bookmarkCount} categories=${view.categoriesDone}/${view.bookmarkCount} domains=${view.domainsDone}/${view.bookmarkCount} classifier=${view.classificationEngine}${view.classificationEngine === 'codex' ? `:${view.codexModel}` : ''} access=claude:${view.classifierAccess.claude ? 'yes' : 'no'},codex:${view.classifierAccess.codex ? 'yes' : 'no'}${classification} updated=${view.lastUpdated ?? 'never'} mode="${view.mode}"`;
}
