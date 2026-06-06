import { describe, it, expect } from 'vitest';
import { extractText } from '../src/lib/pdf/extractText';

/** Build a minimal but valid single-page PDF with two text lines. */
function buildPdf(lines: string[]): Uint8Array {
  const content =
    'BT /F1 12 Tf 72 700 Td ' +
    lines.map((l, i) => `${i === 0 ? '' : '0 -20 Td '}(${l}) Tj`).join(' ') +
    ' ET';
  const objs: Record<number, string> = {
    1: '<</Type/Catalog/Pages 2 0 R>>',
    2: '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    3: '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    4: `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    5: '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  };
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i <= 5; i++) {
    offsets[i] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, 'latin1'));
}

describe('extractText (pdf.js, Node runtime)', () => {
  it('extracts text and preserves line order top-to-bottom', async () => {
    const pdf = buildPdf(['Dec 1 INTRALOX PAYROLL', 'Dec 2 NISSAN AUTO LOAN']);
    const text = await extractText(pdf);
    expect(text).toContain('INTRALOX PAYROLL');
    expect(text).toContain('NISSAN AUTO LOAN');
    const lines = text.split('\n').filter(Boolean);
    expect(lines.indexOf('Dec 1 INTRALOX PAYROLL')).toBeLessThan(
      lines.indexOf('Dec 2 NISSAN AUTO LOAN'),
    );
  });
});
