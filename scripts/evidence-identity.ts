import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const EVIDENCE_IDENTITY_VERSION = 'uduck-execution-inputs-v2';
export const EVIDENCE_ENV =
  'uduck-evidence-env-v1:ubuntu-24.04:python3.12:mujoco==3.12.0:onnxruntime==1.29.0:numpy==2.5.2:pillow==12.3.0';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

function runnerFiles(): string[] {
  function files(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'tests' ? [] : files(path.join(dir, e.name))) : e.name.endsWith('.py') ? [path.join(dir, e.name)] : []);
  }
  return [...files('simulation'), 'simulation/assets.lock.json', 'simulation/requirements.txt'].sort();
}

export function runnerDigest(): string {
  const hash = createHash('sha256');
  for (const file of runnerFiles()) hash.update(file).update('\0').update(fs.readFileSync(file)).update('\0');
  return hash.digest('hex');
}

function fileDigest(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function executionDescriptor(id: string): unknown {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid behavior id');
  const policyPath = `registry/policies/${id}.json`;
  if (fs.existsSync(policyPath)) {
    const data = JSON.parse(fs.readFileSync(policyPath, 'utf8')) as Record<string, any>;
    const source = (data.source ?? {}) as Record<string, unknown>;
    return {
      artifact_sha256: source.artifact_sha256 ?? null,
      id: data.id ?? null,
      kind: 'policy',
      manifest_sha256: source.manifest_sha256 ?? null,
      repo: source.repo ?? null,
      revision: source.revision ?? null,
    };
  }
  const data = JSON.parse(fs.readFileSync(`registry/behaviors/${id}.json`, 'utf8')) as Record<string, any>;
  const contract = (data.contract ?? {}) as Record<string, unknown>;
  const compatibility = (data.compatibility ?? {}) as Record<string, unknown>;
  const onnx = ((data.artifacts ?? {}) as Record<string, any>).onnx ?? {};
  return {
    artifact_url: onnx.url ?? null,
    compatibility: { robot_model: compatibility.robot_model ?? null },
    contract: {
      action_dim: contract.action_dim ?? null,
      action_scale: contract.action_scale ?? null,
      actuator_model: contract.actuator_model ?? null,
      control_frequency_hz: contract.control_frequency_hz ?? null,
      decimation: contract.decimation ?? null,
      observation_dim: contract.observation_dim ?? null,
    },
    id: data.id ?? null,
    kind: 'manual',
    simulation: data.simulation ?? null,
  };
}

export function evidenceInputsDigest(id: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Invalid behavior id');
  const hash = createHash('sha256');
  hash.update(EVIDENCE_IDENTITY_VERSION).update('\0');
  hash.update(canonicalJson(executionDescriptor(id))).update('\0');
  hash.update(runnerDigest()).update('\0');
  hash.update(fileDigest('simulation/assets.lock.json')).update('\0');
  hash.update(fileDigest('simulation/requirements.txt')).update('\0');
  hash.update(EVIDENCE_ENV);
  return hash.digest('hex');
}
