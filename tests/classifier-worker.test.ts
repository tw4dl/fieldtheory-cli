import test from 'node:test';
import assert from 'node:assert/strict';
import { runClassifierWorker } from '../src/classifier-worker.js';

test('worker passes stdin and returns only stdout', async () => {
  const output = await runClassifierWorker(process.execPath, ['-e',
    "process.stdin.on('data', d => process.stdout.write(d)); process.stderr.write('diagnostic');"],
  { env: process.env, input: '[]' });
  assert.equal(output, '[]');
});

test('worker surfaces nonzero exit and missing executable', async () => {
  await assert.rejects(runClassifierWorker(process.execPath, ['-e',
    "process.stderr.write('provider failed'); process.exit(2)"], { env: process.env }), /exit 2.*\nprovider failed/);
  await assert.rejects(runClassifierWorker('/missing/ft-worker', [], { env: process.env }), /ENOENT/);
});

test('worker enforces timeout and output limits', async () => {
  await assert.rejects(runClassifierWorker(process.execPath, ['-e', 'setInterval(() => {}, 1000)'],
    { env: process.env, timeoutMs: 100 }), /timed out/);
  await assert.rejects(runClassifierWorker(process.execPath, ['-e', "process.stdout.write('x'.repeat(4096))"],
    { env: process.env, maxBytes: 100 }), /output exceeds limit/);
});

test('worker cleans up descendants after parent exit', { skip: process.platform === 'win32' }, async () => {
  const output = await runClassifierWorker(process.execPath, ['-e',
    "const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); console.log(c.pid); c.unref();"],
  { env: process.env, timeoutMs: 1000 });
  const pid = Number(output);
  assert.ok(pid > 0);
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.throws(() => process.kill(pid, 0), /ESRCH/);
});
