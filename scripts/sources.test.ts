import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCES } from './sources.ts';

describe('sources.ts', () => {
  const modifications = Object.values(SOURCES).flatMap((s) => s.modifications);

  it('gives every modification a unique id', () => {
    const ids = modifications.map((m) => m.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('points every modification at files that exist', () => {
    const missing = modifications.flatMap((m) => m.where.filter((f) => !existsSync(f)).map((f) => `${m.id}: ${f}`));
    expect(missing).toEqual([]);
  });
});
