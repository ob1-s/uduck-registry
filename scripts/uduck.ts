#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
const [command, ...args] = process.argv.slice(2);
if (!['resolve', 'register', 'prepare'].includes(command ?? '')) {
  console.error('Usage: pnpm uduck resolve|register <https://huggingface.co/owner/repo> [--category experimental] [--id slug]\n       pnpm uduck prepare\nRequires Python with scripts/policy/requirements.txt installed; set UDUCK_PYTHON to its executable.');
  process.exitCode = 1;
} else {
  const result = spawnSync(process.env.UDUCK_PYTHON ?? 'python3', ['scripts/policy/resolve.py', command!, ...args], { stdio: 'inherit', timeout: 300_000 });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
