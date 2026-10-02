// Merchant stems for CARD PURCHASES. The parser's `descriptionNorm` is tuned for
// checking-account rows and feeds the dedupe key, so it must not change. Card
// rows ("Debit Card Purchase - CLAUDE AI SUBSCRIPTION XXXXXXX0599 CA") carry
// store numbers, phone numbers and a trailing city/state that would split one
// merchant into many groups, so the engine derives its own stem from the raw
// description instead.

/** "Debit Card Purchase - …" / "Digital Card Purchase - …". */
export const CARD_PURCHASE = /^(?:debit|digital) card purchase\s*-\s*/i;

export function isCardPurchase(raw: string): boolean {
  return CARD_PURCHASE.test(raw.trim());
}

export interface Merchant {
  /** Stable uppercase grouping key. */
  stem: string;
  /** Human display name. */
  name: string;
}

/** Brands whose raw descriptors vary between charges (or read badly). Matching
 *  here guarantees one group and a clean name; anything else falls through to
 *  the generic cleaner. */
const BRANDS: Array<{ test: RegExp; stem: string; name: string }> = [
  { test: /claude|anthropic/i, stem: 'CLAUDE', name: 'Claude' },
  { test: /openai|chatgpt/i, stem: 'CHATGPT', name: 'ChatGPT' },
  { test: /\bcursor\b/i, stem: 'CURSOR', name: 'Cursor' },
  { test: /kindle/i, stem: 'KINDLE UNLIMITED', name: 'Kindle Unlimited' },
  { test: /audible/i, stem: 'AUDIBLE', name: 'Audible' },
  { test: /prime video/i, stem: 'PRIME VIDEO', name: 'Prime Video' },
  { test: /amazon prime|amzn prime/i, stem: 'AMAZON PRIME', name: 'Amazon Prime' },
  { test: /apple\.com|apple com bill/i, stem: 'APPLE', name: 'Apple' },
  { test: /google\s*\*?\s*(one|storage)/i, stem: 'GOOGLE ONE', name: 'Google One' },
  { test: /youtube/i, stem: 'YOUTUBE', name: 'YouTube' },
  { test: /playstation/i, stem: 'PLAYSTATION', name: 'PlayStation' },
  { test: /xbox|microsoft\s*\*/i, stem: 'MICROSOFT', name: 'Microsoft' },
  { test: /nintendo/i, stem: 'NINTENDO', name: 'Nintendo' },
  { test: /netflix/i, stem: 'NETFLIX', name: 'Netflix' },
  { test: /spotify/i, stem: 'SPOTIFY', name: 'Spotify' },
  { test: /hulu/i, stem: 'HULU', name: 'Hulu' },
  { test: /disney/i, stem: 'DISNEY PLUS', name: 'Disney+' },
  { test: /peacock/i, stem: 'PEACOCK', name: 'Peacock' },
  { test: /paramount/i, stem: 'PARAMOUNT PLUS', name: 'Paramount+' },
  { test: /\bhbo\b|hbomax|\bmax\.com/i, stem: 'MAX', name: 'Max' },
  { test: /canva/i, stem: 'CANVA', name: 'Canva' },
  { test: /adobe/i, stem: 'ADOBE', name: 'Adobe' },
  { test: /dropbox/i, stem: 'DROPBOX', name: 'Dropbox' },
  { test: /github/i, stem: 'GITHUB', name: 'GitHub' },
  { test: /nytimes|new york times/i, stem: 'NEW YORK TIMES', name: 'New York Times' },
];

export function cardMerchant(raw: string): Merchant {
  const body = raw.trim().replace(CARD_PURCHASE, '');
  for (const b of BRANDS) {
    if (b.test.test(body)) return { stem: b.stem, name: b.name };
  }
  const stem = body
    .toUpperCase()
    .replace(/[*#]/g, ' ')
    .split(/\s+/)
    // Store numbers, masked refs, phone fragments, order ids.
    .filter((tok) => tok.length > 0 && !/\d/.test(tok) && !/^X{3,}$/.test(tok))
    .join(' ')
    // Trailing "CA", ", CA", ", CA US".
    .replace(/,?\s+[A-Z]{2}(\s+US)?$/, '')
    .replace(/[,.\s]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { stem: stem || body.toUpperCase(), name: titleCase(stem || body) };
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
