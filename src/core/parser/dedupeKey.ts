// Stable dedupe key for a transaction. The SAME economic event must yield the
// SAME key whether it arrives via PDF, manual entry, or Plaid — so the key is
// derived only from account + date + signed amount + normalized description,
// deliberately excluding the source and running balance.

/** Tiny synchronous FNV-1a hash -> hex. Good enough for a stable dedupe key
 *  (not a security primitive; runtime may also store source-native ids). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildDedupeKey(parts: {
  accountMask: string;
  postedDate: string;
  amountCents: number;
  descriptionNorm: string;
}): string {
  const canonical = [
    parts.accountMask,
    parts.postedDate,
    parts.amountCents,
    parts.descriptionNorm,
  ].join('|');
  return fnv1a(canonical);
}
