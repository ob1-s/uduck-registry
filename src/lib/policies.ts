import fs from 'node:fs';
import path from 'node:path';
import { PolicyPointerSchema, type ResolvedPolicy } from '../../registry/schema/policy';

export function getPolicies(): ResolvedPolicy[] {
  const dir = path.resolve('registry/policies');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(file => {
    const pointer = PolicyPointerSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    const cache = path.resolve('.generated/policies', file);
    if (!fs.existsSync(cache)) throw new Error(`Run pnpm policies:prepare before building: missing ${file}`);
    const resolved = JSON.parse(fs.readFileSync(cache, 'utf8')) as ResolvedPolicy;
    if (Object.entries(pointer.source).some(([key, value]) => resolved.source[key as keyof typeof pointer.source] !== value || resolved.resolved.source[key as keyof typeof pointer.source] !== value)) throw new Error(`Stale policy resolution: ${file}`);
    return { ...pointer, resolved: resolved.resolved };
  });
}
export function policyName(p: ResolvedPolicy): string {
  return typeof p.resolved.manifest.name === 'string' ? p.resolved.manifest.name : p.id;
}
export function policySummary(p: ResolvedPolicy): string {
  return p.curation.summary ?? (typeof p.resolved.manifest.description === 'string' ? p.resolved.manifest.description : 'Microduck policy published on Hugging Face.');
}
