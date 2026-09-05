import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export function evidenceInputsDigest(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid behavior id');
  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'tests' ? [] : files(path.join(dir, e.name))) : e.name.endsWith('.py') ? [path.join(dir, e.name)] : []);
  }
  const paths = [`registry/behaviors/${id}.json`, ...files('simulation'), 'simulation/assets.lock.json', 'simulation/requirements.txt'].sort();
  const hash = createHash('sha256');
  for (const file of paths) hash.update(file).update('\0').update(fs.readFileSync(file)).update('\0');
  return hash.digest('hex');
}
