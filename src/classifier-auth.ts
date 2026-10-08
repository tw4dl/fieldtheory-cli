import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function classifierCodexHome(env: NodeJS.ProcessEnv = process.env): string {
  if (env.FT_CODEX_HOME) return env.FT_CODEX_HOME;
  const home = env.HOME || os.homedir();
  const isolated = path.join(env.FT_DATA_DIR || path.join(home, '.ft-bookmarks'), 'codex');
  if (fs.existsSync(path.join(isolated, 'auth.json'))) return isolated;
  return env.CODEX_HOME || path.join(home, '.codex');
}

export function hasIsolatedCodexLogin(env: NodeJS.ProcessEnv = process.env): boolean {
  const home = env.HOME || os.homedir();
  return Boolean(env.FT_CODEX_HOME) || fs.existsSync(path.join(
    env.FT_DATA_DIR || path.join(home, '.ft-bookmarks'), 'codex', 'auth.json',
  ));
}

export function codexEnvironment(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const home = classifierCodexHome(env);
  let mode: unknown;
  try { mode = JSON.parse(fs.readFileSync(path.join(home, 'auth.json'), 'utf8')).auth_mode; }
  catch { /* Missing or malformed credentials must not fall back to API billing. */ }
  if (mode !== 'chatgpt') {
    throw new Error(`ChatGPT login required for classification. Run: CODEX_HOME=${JSON.stringify(home)} codex login --device-auth`);
  }
  return { HOME: env.HOME, PATH: env.PATH, TERM: env.TERM || 'xterm-256color', CODEX_HOME: home };
}
