import fs from 'node:fs';
import path from 'node:path';
import { PolicySchema, type ResolvedPolicy } from '../../registry/schema/policy';

export function getResolvedPolicies(): ResolvedPolicy[] {
  const dir = path.resolve('registry/policies');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(file => {
    const policy = PolicySchema.parse(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
    const cache = path.resolve('.generated/policies', file);
    if (!fs.existsSync(cache)) throw new Error(`Run pnpm policies:prepare before building: missing ${file}`);
    const resolved = JSON.parse(fs.readFileSync(cache, 'utf8')) as ResolvedPolicy;
    const sourceKeys = Object.keys(policy.source) as Array<keyof typeof policy.source>;
    if (sourceKeys.some((key) => resolved.source[key] !== policy.source[key] || resolved.resolved.source[key] !== policy.source[key])) {
      throw new Error(`Stale policy resolution: ${file}`);
    }
    return { ...policy, resolved: resolved.resolved };
  });
}

export const getPolicies = getResolvedPolicies;
export function policyName(p: ResolvedPolicy): string {
  return typeof p.resolved.manifest?.name === 'string' ? p.resolved.manifest.name : p.curation.name ?? p.id;
}
export function policySummary(p: ResolvedPolicy): string {
  return p.curation.summary ?? (typeof p.resolved.manifest?.description === 'string' ? p.resolved.manifest.description : `Policy artifact from ${p.source.repo}.`);
}
