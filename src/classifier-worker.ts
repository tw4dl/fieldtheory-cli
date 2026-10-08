import { spawn } from 'node:child_process';

export function runClassifierWorker(
  executable: string,
  args: string[],
  options: { env: NodeJS.ProcessEnv; cwd?: string; input?: string; timeoutMs?: number; maxBytes?: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    const grouped = process.platform !== 'win32';
    const child = spawn(executable, args, {
      env: options.env, cwd: options.cwd, detached: grouped, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let failure: Error | undefined;
    const stop = () => {
      if (!child.pid) return;
      try {
        if (grouped) process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch { /* The worker may already have exited. */ }
    };
    const timer = setTimeout(() => {
      failure = new Error('Classifier worker timed out');
      stop();
    }, options.timeoutMs ?? 120_000);
    const collect = (chunk: Buffer, isError: boolean) => {
      bytes += chunk.length;
      if (bytes > (options.maxBytes ?? 1024 * 1024)) {
        failure = new Error('Classifier worker output exceeds limit');
        stop();
        return;
      }
      if (isError) stderr += chunk.toString();
      else stdout += chunk.toString();
    };
    child.stdout.on('data', chunk => collect(chunk, false));
    child.stderr.on('data', chunk => collect(chunk, true));
    child.stdin.on('error', () => { /* Early worker exit is reported below. */ });
    child.on('error', error => { failure = error; });
    // Reap descendants even when acpx exits before its own adapter.
    child.on('exit', stop);
    child.on('close', code => {
      clearTimeout(timer);
      stop();
      if (failure) reject(failure);
      else if (code !== 0) reject(new Error(`Classifier worker failed (exit ${code})${stderr.trim() ? `\n${stderr.trim()}` : ''}`));
      else resolve(stdout.trim());
    });
    child.stdin.end(options.input);
  });
}
