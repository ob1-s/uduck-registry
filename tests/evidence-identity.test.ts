import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { evidenceInputsDigest } from '../scripts/evidence-identity';
import { PolicyPointerSchema } from '../registry/schema/policy';
describe('provenance boundaries', () => {
  it('uses the same full runner identity in publication and display', () => {
    const python = execFileSync('python3', ['-c', 'import sys; sys.path.insert(0,"simulation"); from evidence import inputs_digest; print(inputs_digest("alpha-walking"))'], { encoding: 'utf8' }).trim();
    expect(evidenceInputsDigest('alpha-walking')).toBe(python);
    expect(evidenceInputsDigest('jump')).not.toBe(python);
  });
  it('rejects unpinned pointers and authored verification claims', () => {
    const pointer = { id: 'test', source: { repo: 'o/r', revision: 'a'.repeat(40), artifact_sha256: 'b'.repeat(64), manifest_sha256: 'c'.repeat(64) }, curation: { category: 'experimental' } };
    expect(PolicyPointerSchema.safeParse(pointer).success).toBe(true);
    expect(PolicyPointerSchema.safeParse({ ...pointer, verification: 'passed' }).success).toBe(false);
    expect(PolicyPointerSchema.safeParse({ ...pointer, source: { ...pointer.source, revision: 'main' } }).success).toBe(false);
  });
});
