import { describe, expect, it } from 'vitest';
import { runWithRetry } from './concurrency.ts';

describe('runWithRetry', () => {
  const noWait = { limit: 2, delayMs: 5000, wait: async () => {} };

  it('retries failed items once, after the delay', async () => {
    const tries = new Map<string, number>();
    const waits: number[] = [];
    const flaky = async (id: string) => {
      const n = (tries.get(id) ?? 0) + 1;
      tries.set(id, n);
      if (id === 'Akshan' && n === 1) throw new Error('fetch failed');
      return id.length;
    };
    const retried: string[] = [];
    const { results, failed } = await runWithRetry(['Ahri', 'Akshan', 'Zed'], flaky, {
      ...noWait,
      wait: async (ms) => { waits.push(ms); },
      onRetry: (f) => retried.push(...f.map((x) => x.item)),
    });
    expect(failed).toEqual([]);
    expect([...results.entries()].sort()).toEqual([['Ahri', 4], ['Akshan', 6], ['Zed', 3]]);
    expect(retried).toEqual(['Akshan']);
    expect(waits).toEqual([5000]);
    expect(tries.get('Akshan')).toBe(2);
    expect(tries.get('Ahri')).toBe(1);
  });

  it('reports items that still fail after the retry', async () => {
    const { failed } = await runWithRetry(['Ahri', 'Akshan'], async (id) => {
      if (id === 'Akshan') throw new Error('503 Service Unavailable');
      return id;
    }, noWait);
    expect(failed.map((f) => [f.item, f.error.message])).toEqual([['Akshan', '503 Service Unavailable']]);
  });

  it("doesn't wait when nothing fails", async () => {
    let waited = false;
    await runWithRetry(['Ahri'], async (id) => id, { ...noWait, wait: async () => { waited = true; } });
    expect(waited).toBe(false);
  });
});
