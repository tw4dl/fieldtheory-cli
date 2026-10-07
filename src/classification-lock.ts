import fs from 'node:fs';
import path from 'node:path';
import { dataDir, ensureDataDir } from './paths.js';

export interface ClassificationLock {
  pid: number;
  kind: 'classify' | 'classify-domains';
  startedAt: string;
}

function lockPath(): string {
  return path.join(dataDir(), 'classification-lock.json');
}

export function readClassificationLock(): ClassificationLock | null {
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath(), 'utf8'));
    if (!Number.isInteger(lock.pid) || lock.pid <= 0 ||
        !['classify', 'classify-domains'].includes(lock.kind) ||
        typeof lock.startedAt !== 'string') return null;
    try {
      process.kill(lock.pid, 0);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') return null;
    }
    return lock;
  } catch {
    return null;
  }
}

export async function withClassificationLock<T>(
  kind: ClassificationLock['kind'], fn: () => Promise<T>,
): Promise<T> {
  ensureDataDir();
  const existing = readClassificationLock();
  if (existing) throw new Error(`Classification already running (${existing.kind}, pid ${existing.pid})`);
  // Replace a stale file, then acquire exclusively to reject competing writers.
  if (fs.existsSync(lockPath())) fs.rmSync(lockPath(), { force: true });
  const lock: ClassificationLock = { pid: process.pid, kind, startedAt: new Date().toISOString() };
  fs.writeFileSync(lockPath(), JSON.stringify(lock), { flag: 'wx', mode: 0o600 });
  try {
    return await fn();
  } finally {
    const current = readClassificationLock();
    if (current?.pid === lock.pid && current.startedAt === lock.startedAt) {
      fs.rmSync(lockPath(), { force: true });
    }
  }
}
