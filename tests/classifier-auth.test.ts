import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifierCodexHome, codexEnvironment } from '../src/classifier-auth.js';

test('isolated ChatGPT login wins over inherited API-key configuration', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-auth-'));
  const home = path.join(root, 'codex');
  fs.mkdirSync(home);
  fs.writeFileSync(path.join(home, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt' }));
  const env = { FT_DATA_DIR: root, HOME: root, PATH: '/bin', CODEX_HOME: '/paid', OPENAI_API_KEY: 'secret' };
  try {
    assert.equal(classifierCodexHome(env), home);
    const child = codexEnvironment(env);
    assert.equal(child.CODEX_HOME, home);
    assert.equal(child.OPENAI_API_KEY, undefined);
    assert.equal(child.FT_DATA_DIR, undefined);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('API-key, missing, and malformed logins fail before classification', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ft-auth-'));
  try {
    for (const content of [null, '{broken', JSON.stringify({ auth_mode: 'apikey', OPENAI_API_KEY: 'secret' })]) {
      if (content !== null) fs.writeFileSync(path.join(root, 'auth.json'), content);
      assert.throws(() => codexEnvironment({ FT_CODEX_HOME: root }), /ChatGPT login required/);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('explicit classifier home takes precedence', () => {
  assert.equal(classifierCodexHome({ FT_CODEX_HOME: '/classifier', CODEX_HOME: '/other' }), '/classifier');
});
