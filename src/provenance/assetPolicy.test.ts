import { describe, it, expect } from 'vitest';
import { validateAssets } from '../../scripts/lib/asset-policy.mjs';
const campaign = (url: string, durationSeconds = 4) => ({ scenes: [{ imageUrl: url, durationSeconds }] });
describe('render asset policy', () => {
  it('accepts exact trusted HTTPS origins', () => {
    expect(() => validateAssets(campaign('https://assets.example/a.png'), 'https://assets.example')).not.toThrow();
  });
  it.each(['http://assets.example/a', 'https://evil.example/a', 'https://assets.example.evil.test/a', 'file:///etc/passwd', 'http://127.0.0.1/a', 'https://user:pass@assets.example/a'])('rejects %s', url => {
    expect(() => validateAssets(campaign(url), 'https://assets.example')).toThrow();
  });
  it('rejects excessive render duration and scene count', () => {
    expect(() => validateAssets(campaign('', 121), '')).toThrow();
    expect(() => validateAssets({ scenes: Array(31).fill({ durationSeconds: 1 }) }, '')).toThrow();
  });
});
