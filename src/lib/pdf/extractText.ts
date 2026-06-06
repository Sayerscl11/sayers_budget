// Turn an uploaded PDF buffer into the newline-separated text the statement
// parser consumes. Runs in the Node runtime (no worker, no canvas). The parser
// is position-tolerant, but it expects one transaction's pieces to land on
// readable lines, so we group pdf.js text items into visual lines by their
// y-coordinate and order each line left-to-right by x.

interface TextItem {
  str: string;
  transform: number[]; // [a, b, c, d, e(x), f(y)]
}

/** Vertical tolerance (in PDF units) for treating items as the same line. */
const LINE_TOLERANCE = 3;

export async function extractText(data: Uint8Array): Promise<string> {
  // Dynamic import keeps pdf.js out of the module graph until actually needed.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: true,
    // No worker in Node: run on the main thread.
    disableFontFace: true,
  }).promise;

  const pages: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(itemsToLines(content.items as TextItem[]));
  }
  await doc.cleanup();
  return pages.join('\n');
}

/** Bucket text items into visual lines (by y), each ordered by x, then joined. */
function itemsToLines(items: TextItem[]): string {
  const lines: { y: number; items: TextItem[] }[] = [];

  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform[5];
    // Find an existing line within tolerance (pdf.js y grows upward).
    let line = lines.find((l) => Math.abs(l.y - y) <= LINE_TOLERANCE);
    if (!line) {
      line = { y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  // Top-to-bottom (descending y), then left-to-right within each line.
  lines.sort((a, b) => b.y - a.y);
  return lines
    .map((l) =>
      l.items
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map((i) => i.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 0)
    .join('\n');
}
