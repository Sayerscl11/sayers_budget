// Description normalization + label extraction. The normalized stem is the
// single key used by both dedupe and recurring-grouping, so it lives here and is
// imported by the engine too.

import { DEBIT_CARD_LABEL } from './patterns';

/** Known merchant stems — guarantees correct grouping for the household's
 *  recurring items even when the raw description carries trailing noise. */
const MERCHANT_STEMS: Array<{ test: RegExp; stem: string }> = [
  { test: /legacy real est/i, stem: 'LEGACY REAL ESTATE' },
  { test: /capital one mobile/i, stem: 'CAPITAL ONE CARD PAYMENT' },
  { test: /nissan/i, stem: 'NISSAN AUTO LOAN' },
  { test: /\batt\b|at&t|att payment/i, stem: 'ATT' },
  { test: /verizon/i, stem: 'VERIZON' },
  { test: /ppl (rhode|ri)/i, stem: 'PPL ELECTRIC' },
  { test: /massmutual|mass mutual/i, stem: 'MASSMUTUAL' },
  { test: /planet fitness/i, stem: 'PLANET FITNESS' },
  { test: /goldfish/i, stem: 'GOLDFISH SWIM' },
  { test: /wealthfront/i, stem: 'WEALTHFRONT' },
  { test: /appfolio/i, stem: 'APPFOLIO' },
  { test: /intralox/i, stem: 'INTRALOX PAYROLL' },
  { test: /natchaug/i, stem: 'NATCHAUG PAYROLL' },
  { test: /women and infant/i, stem: 'WOMEN AND INFANTS SALARY' },
  { test: /joanne stokes/i, stem: 'ZELLE JOANNE STOKES' },
  { test: /monthly interest/i, stem: 'INTEREST' },
  { test: /apple\.com|apple com bill/i, stem: 'APPLE' },
];

/**
 * Produce a stable, comparable merchant stem from a raw description.
 * Strips reference noise (dates, confirmation codes, "WEB PMTS", trailing
 * digits), uppercases, and collapses whitespace. Falls back to a generic
 * cleaner when no known stem matches.
 */
export function normalizeDescription(raw: string): string {
  const text = raw.trim();
  for (const { test, stem } of MERCHANT_STEMS) {
    if (test.test(text)) return stem;
  }
  return text
    .toUpperCase()
    .replace(/\bXXXX+\d{0,4}\b/g, ' ')
    .replace(/\bWEB PMTS?\b/g, ' ')
    .replace(/\bMOBILE PMT\b/g, ' ')
    .replace(/\b(PAYMENT|PMT|PYMNTS?|PYMT)\b/g, ' ')
    .replace(/\b\d{6,}\b/g, ' ')
    .replace(/[#*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract a hand-typed discretionary label from a debit-card withdrawal, e.g.
 * "Magnesium - Withdrawal to Debit Card Account" => "Magnesium". Returns null
 * for bare/unlabeled withdrawals or non-debit-card descriptions.
 */
export function extractLabel(raw: string): string | null {
  const m = raw.match(DEBIT_CARD_LABEL);
  if (!m) return null;
  const label = m[1].trim();
  return label.length > 0 ? label : null;
}
