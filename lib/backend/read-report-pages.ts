import { BackendError, unwrap } from "./errors";

type Page<T> = { data: T[] | null; error: { code?: string; message: string } | null; count: number | null };

export async function readReportPages<T>(fetchPage: (from: number, to: number) => PromiseLike<Page<T>>) {
  const size = 1000;
  const first = await fetchPage(0, size - 1);
  const rows: T[] = unwrap(first) ?? [];
  const count = first.count;
  const incomplete = () =>
    new BackendError(
      400,
      "REPORT_RANGE_TOO_LARGE",
      "The complete report could not be loaded. Refresh or choose a shorter period.",
    );
  if (count === null || count > 50_000 || rows.length !== Math.min(count, size)) throw incomplete();
  for (let from = size; from < count; from += size * 4) {
    const starts: number[] = Array.from(
      { length: Math.min(4, Math.ceil((count - from) / size)) },
      (_, index) => from + index * size,
    );
    const pages: Page<T>[] = await Promise.all(starts.map((start) => fetchPage(start, start + size - 1)));
    for (const [index, page] of pages.entries()) {
      const values: T[] = unwrap(page) ?? [];
      if ((page.count !== null && page.count !== count) || values.length !== Math.min(size, count - starts[index]))
        throw incomplete();
      rows.push(...values);
    }
  }
  return { data: rows, count, error: null };
}
