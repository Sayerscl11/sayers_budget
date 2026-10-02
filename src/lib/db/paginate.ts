// Supabase (PostgREST) returns at most 1,000 rows per request unless a range is
// given, and it does so silently. A household passes 1,000 transactions within
// a few statements, so any query that must see every row pages through here.

export const PAGE_SIZE = 1000;

/** Fetch every row by walking inclusive `[from, to]` ranges until a short page. */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<T[]>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    all.push(...page);
    if (page.length < pageSize) return all;
  }
}
