// Subscription detection. Recurring bills (`recurring.ts`) only see the main
// checking account, but the household's subscriptions are charged to the debit
// card, whose account is otherwise ignored as a mirror. This reads those card
// purchases directly and finds fixed-price charges that repeat about once a
// month.
//
// A subscription "stream" is one merchant at one price. A merchant can have
// several (Apple bills iCloud and an app separately), so purchases are grouped
// by merchant stem and then split by amount.

import type { Txn } from '../types';
import { addMonths, daysBetween, monthKey } from '../dates';
import { medianCents } from '../money';
import type { RecurringItemInput } from './period';
import { cardMerchant, isCardPurchase } from './merchant';

export interface Subscription {
  /** Stable id for saved decisions: the stem, plus the price when a merchant
   *  has more than one stream. */
  key: string;
  name: string;
  /** What it costs now (the most recent charge), in cents. */
  amountCents: number;
  firstDate: string;
  lastDate: string;
  /** Next charge, projected a month at a time from the last one. */
  nextDate: string;
  occurrences: number;
  /** Still being charged as of the newest card activity we have. */
  current: boolean;
  /** Counted in the monthly total and the forecast. Defaults to `current`;
   *  a saved override wins. */
  included: boolean;
  /** Whether the household has saved a decision for this one. */
  confirmed: boolean;
  txnIds: string[];
}

export interface SubscriptionOverride {
  key: string;
  included: boolean;
}

/** Prices within 10% (or $1) are the same stream, so a price rise or a tax
 *  change doesn't split it. */
function sameStream(aCents: number, bCents: number): boolean {
  const hi = Math.max(aCents, bCents);
  return Math.abs(aCents - bCents) <= Math.max(100, Math.round(hi * 0.1));
}

/** A gap counts as monthly if it is a whole number of months, give or take 6
 *  days. Whole multiples are allowed so a missing statement doesn't break a
 *  streak. */
function isMonthlyGap(days: number): boolean {
  const months = Math.round(days / 30.44);
  return months >= 1 && Math.abs(days - months * 30.44) <= 6;
}

/** No charge for this long after the last one means it has probably ended. */
const LAPSED_AFTER_DAYS = 45;

export function detectSubscriptions(
  txns: Txn[],
  overrides: SubscriptionOverride[] = [],
): Subscription[] {
  const purchases = txns.filter((t) => t.amountCents < 0 && isCardPurchase(t.descriptionRaw));
  if (purchases.length === 0) return [];

  // "Now" is the newest card purchase on file, not the calendar date: if last
  // month's statement isn't imported yet, nothing should look cancelled.
  const asOf = purchases.reduce((m, t) => (t.postedDate > m ? t.postedDate : m), '');

  const byStem = new Map<string, { name: string; txns: Txn[] }>();
  for (const t of purchases) {
    const m = cardMerchant(t.descriptionRaw);
    const g = byStem.get(m.stem) ?? byStem.set(m.stem, { name: m.name, txns: [] }).get(m.stem)!;
    g.txns.push(t);
  }

  const found: Array<
    Omit<Subscription, 'key' | 'included' | 'confirmed'> & { stem: string; typicalCents: number }
  > = [];
  for (const [stem, group] of byStem) {
    // Split the merchant's charges into price streams.
    const sorted = [...group.txns].sort((a, b) => a.amountCents - b.amountCents);
    const streams: Txn[][] = [];
    for (const t of sorted) {
      const last = streams[streams.length - 1];
      if (last && sameStream(Math.abs(last[last.length - 1].amountCents), Math.abs(t.amountCents))) {
        last.push(t);
      } else {
        streams.push([t]);
      }
    }

    for (const stream of streams) {
      const s = [...stream].sort((a, b) => a.postedDate.localeCompare(b.postedDate));
      if (s.length < 2) continue;
      // Two similar charges a month apart are often coincidence (two grocery
      // runs); with only two to go on, the price has to match to the cent.
      if (s.length === 2 && s[0].amountCents !== s[1].amountCents) continue;
      // At most one charge a month — repeat visits to a shop are not a subscription.
      const months = new Set(s.map((t) => monthKey(t.postedDate)));
      if (months.size < s.length) continue;
      const gaps = s.slice(1).map((t, i) => daysBetween(s[i].postedDate, t.postedDate));
      if (!gaps.every(isMonthlyGap)) continue;

      const lastDate = s[s.length - 1].postedDate;
      found.push({
        stem,
        typicalCents: medianCents(s.map((t) => Math.abs(t.amountCents))),
        name: group.name,
        amountCents: Math.abs(s[s.length - 1].amountCents),
        firstDate: s[0].postedDate,
        lastDate,
        nextDate: addMonths(lastDate, 1),
        occurrences: s.length,
        current: daysBetween(lastDate, asOf) <= LAPSED_AFTER_DAYS,
        txnIds: s.map((t) => t.id),
      });
    }
  }

  const perStem = new Map<string, number>();
  for (const f of found) perStem.set(f.stem, (perStem.get(f.stem) ?? 0) + 1);
  const saved = new Map(overrides.map((o) => [o.key, o.included]));

  return found
    .map(({ stem, typicalCents, ...f }) => {
      const multi = (perStem.get(stem) ?? 0) > 1;
      const key = multi ? `${stem} @${(typicalCents / 100).toFixed(2)}` : stem;
      const override = saved.get(key);
      return {
        ...f,
        key,
        included: override ?? f.current,
        confirmed: override !== undefined,
      };
    })
    .sort((a, b) => Number(b.included) - Number(a.included) || b.amountCents - a.amountCents);
}

/** Monthly cost of everything counted. */
export function subscriptionMonthlyCents(subs: Subscription[]): number {
  return subs.filter((s) => s.included).reduce((sum, s) => sum + s.amountCents, 0);
}

export interface SubscriptionMonth {
  /** What the counted subscriptions cost per month. */
  monthlyCents: number;
  /** Already charged in `month`. */
  chargedCents: number;
  /** Counted subscriptions with no charge in `month` yet, soonest first. */
  upcoming: Array<{ key: string; name: string; amountCents: number; dueDate: string }>;
  count: number;
}

/** This month's view: what is reserved, what has hit the card, what is left. */
export function subscriptionMonth(
  subs: Subscription[],
  txns: Txn[],
  month: string, // yyyy-mm
): SubscriptionMonth {
  const counted = subs.filter((s) => s.included);
  const byId = new Map(txns.map((t) => [t.id, t]));
  let chargedCents = 0;
  const upcoming: SubscriptionMonth['upcoming'] = [];

  for (const s of counted) {
    const hits = s.txnIds
      .map((id) => byId.get(id))
      .filter((t): t is Txn => !!t && monthKey(t.postedDate) === month);
    if (hits.length > 0) {
      chargedCents += hits.reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
      continue;
    }
    // Roll the projection forward to the first due date in or after `month`.
    let due = s.nextDate;
    while (monthKey(due) < month) due = addMonths(due, 1);
    if (monthKey(due) === month) {
      upcoming.push({ key: s.key, name: s.name, amountCents: s.amountCents, dueDate: due });
    }
  }

  upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return {
    monthlyCents: subscriptionMonthlyCents(subs),
    chargedCents,
    upcoming,
    count: counted.length,
  };
}

/** Counted subscriptions as monthly bills, so the forecast sets the money aside
 *  before anything is called safe to spend. */
export function subscriptionForecastItems(subs: Subscription[]): RecurringItemInput[] {
  return subs
    .filter((s) => s.included)
    .map((s) => ({
      direction: 'bill' as const,
      cadence: 'monthly' as const,
      anchorDate: s.lastDate,
      amountCents: s.amountCents,
    }));
}
