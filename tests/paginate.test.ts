import { describe, it, expect } from 'vitest';
import { fetchAllRows } from '../src/lib/db/paginate';

/** A fake table that, like PostgREST, serves an inclusive range. */
function table(n: number) {
  const rows = Array.from({ length: n }, (_, i) => i);
  const calls: Array<[number, number]> = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    return rows.slice(from, to + 1);
  };
  return { fetchPage, calls };
}

describe('fetchAllRows', () => {
  it('returns everything past the 1,000-row default cap', async () => {
    const t = table(2350);
    const rows = await fetchAllRows(t.fetchPage);
    expect(rows).toHaveLength(2350);
    expect(rows[2349]).toBe(2349);
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('asks once more when the table is an exact multiple of the page size', async () => {
    const t = table(2000);
    expect(await fetchAllRows(t.fetchPage)).toHaveLength(2000);
    expect(t.calls).toHaveLength(3);
  });

  it('handles a small or empty table in one request', async () => {
    expect(await fetchAllRows(table(0).fetchPage)).toEqual([]);
    const t = table(12);
    expect(await fetchAllRows(t.fetchPage)).toHaveLength(12);
    expect(t.calls).toHaveLength(1);
  });

  it('propagates a failed page instead of returning a partial ledger', async () => {
    await expect(
      fetchAllRows(async (from) => {
        if (from > 0) throw new Error('boom');
        return Array.from({ length: 1000 }, (_, i) => i);
      }),
    ).rejects.toThrow('boom');
  });
});
