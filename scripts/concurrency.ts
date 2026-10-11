/** Run `fn` over `items` with at most `limit` running at once; results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface RetryOptions<T> {
  limit: number;
  /** Wait before the retry pass. */
  delayMs: number;
  /** Called with the failures of the first pass, before waiting. */
  onRetry?: (failed: Array<{ item: T; error: Error }>) => void;
  /** For tests. */
  wait?: (ms: number) => Promise<void>;
}

/**
 * Run `fn` over every item, then retry the ones that failed once more after `delayMs`.
 * Returns what succeeded and what still failed after the retry; never throws for an item.
 */
export async function runWithRetry<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  opts: RetryOptions<T>,
): Promise<{ results: Map<T, R>; failed: Array<{ item: T; error: Error }> }> {
  const results = new Map<T, R>();
  const pass = async (batch: T[]) => {
    const failed: Array<{ item: T; error: Error }> = [];
    await mapLimit(batch, opts.limit, async (item) => {
      try {
        results.set(item, await fn(item));
      } catch (err) {
        failed.push({ item, error: err as Error });
      }
    });
    return failed;
  };
  const first = await pass(items);
  if (first.length === 0) return { results, failed: [] };
  opts.onRetry?.(first);
  await (opts.wait ?? sleep)(opts.delayMs);
  const failed = await pass(first.map((f) => f.item));
  return { results, failed };
}
