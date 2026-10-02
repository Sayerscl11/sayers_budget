import { describe, it, expect } from 'vitest';
import type { Txn } from '../src/core/types';
import {
  cardMerchant,
  detectSubscriptions,
  subscriptionForecastItems,
  subscriptionMonth,
  subscriptionMonthlyCents,
} from '../src/core/engine';
import { loadAllTxns } from './_load';

let seq = 0;
function charge(desc: string, date: string, dollars: number): Txn {
  return {
    id: `c${seq++}`,
    accountMask: '2997',
    accountRole: 'spending_pool',
    postedDate: date,
    descriptionRaw: `Debit Card Purchase - ${desc}`,
    descriptionNorm: desc.toUpperCase(),
    amountCents: -Math.round(dollars * 100),
  };
}

describe('cardMerchant', () => {
  it('strips store numbers, masked refs and the trailing state', () => {
    expect(cardMerchant('Debit Card Purchase - SHELL XXXXXXX0800 PROVIDENCE RI').stem).toBe(
      'SHELL PROVIDENCE',
    );
    expect(
      cardMerchant('Digital Card Purchase - STOP SHOP 0725 PROVIDENCE, RI US').stem,
    ).toBe('STOP SHOP PROVIDENCE');
  });

  it('collapses a brand whose descriptor changes between charges', () => {
    const a = cardMerchant('Debit Card Purchase - PLAYSTATION SAN MATEO, CA US');
    const b = cardMerchant('Debit Card Purchase - SIE PLAYSTATIONNETWORK SAN MATEO, CA US');
    expect(a.stem).toBe(b.stem);
    expect(a.name).toBe('PlayStation');
  });
});

describe('detectSubscriptions', () => {
  it('finds a fixed monthly charge and projects the next one', () => {
    const txns = [
      charge('NETFLIX COM CA', '2026-06-04', 15.49),
      charge('NETFLIX COM CA', '2026-07-04', 15.49),
      charge('NETFLIX COM CA', '2026-08-05', 15.49),
    ];
    const [s] = detectSubscriptions(txns);
    expect(s.name).toBe('Netflix');
    expect(s.amountCents).toBe(1549);
    expect(s.nextDate).toBe('2026-09-05');
    expect(s.current).toBe(true);
    expect(s.included).toBe(true);
  });

  it('survives a missing statement month', () => {
    const txns = [
      charge('SPOTIFY USA NY', '2026-01-10', 11.99),
      charge('SPOTIFY USA NY', '2026-03-10', 11.99),
      charge('SPOTIFY USA NY', '2026-04-10', 11.99),
    ];
    expect(detectSubscriptions(txns)).toHaveLength(1);
  });

  it('splits one merchant into separate price streams', () => {
    const txns = ['2026-03', '2026-04', '2026-05'].flatMap((m) => [
      charge('APPLE COM BILL 866 712 7753 CA', `${m}-08`, 3.02),
      charge('APPLE COM BILL 866 712 7753 CA', `${m}-22`, 13.81),
    ]);
    const subs = detectSubscriptions(txns);
    expect(subs.map((s) => s.key).sort()).toEqual(['APPLE @13.81', 'APPLE @3.02']);
  });

  it('follows a price rise and reports the new price', () => {
    const txns = [
      charge('CANVA* I04878 AUSTIN, TX US', '2026-03-12', 15),
      charge('CANVA* I04878 AUSTIN, TX US', '2026-04-12', 16.05),
      charge('CANVA* I04878 AUSTIN, TX US', '2026-05-12', 16.05),
    ];
    const [s] = detectSubscriptions(txns);
    expect(s.occurrences).toBe(3);
    expect(s.amountCents).toBe(1605);
  });

  it('ignores a shop visited several times a month, even at one price', () => {
    const txns = [
      charge('CITY OF PROVIDENCE IP PROVIDENCE RI', '2026-04-12', 2.85),
      charge('CITY OF PROVIDENCE IP PROVIDENCE RI', '2026-04-25', 2.85),
      charge('CITY OF PROVIDENCE IP PROVIDENCE RI', '2026-05-24', 2.85),
    ];
    expect(detectSubscriptions(txns)).toEqual([]);
  });

  it('needs an exact price match when there are only two charges', () => {
    const txns = [
      charge('WHOLEFDS PRO 10014 PROVIDENCE RI', '2026-03-06', 54.27),
      charge('WHOLEFDS PRO 10014 PROVIDENCE RI', '2026-04-06', 57.86),
    ];
    expect(detectSubscriptions(txns)).toEqual([]);
  });

  it('marks a subscription that stopped as not current and leaves it out', () => {
    const txns = [
      charge('CHATGPT SUBSCRIPTION CA', '2026-01-04', 21.4),
      charge('CHATGPT SUBSCRIPTION CA', '2026-02-04', 21.4),
      charge('NETFLIX COM CA', '2026-04-04', 15.49),
      charge('NETFLIX COM CA', '2026-05-04', 15.49),
    ];
    const subs = detectSubscriptions(txns);
    const gpt = subs.find((s) => s.key === 'CHATGPT')!;
    expect(gpt.current).toBe(false);
    expect(gpt.included).toBe(false);
    expect(subscriptionMonthlyCents(subs)).toBe(1549);
  });

  it('measures "current" against the newest card activity, not the calendar', () => {
    // Statements only run to May; nothing should look cancelled in October.
    const txns = [
      charge('NETFLIX COM CA', '2026-04-04', 15.49),
      charge('NETFLIX COM CA', '2026-05-04', 15.49),
    ];
    expect(detectSubscriptions(txns)[0].current).toBe(true);
  });

  it('lets a saved decision override the default either way', () => {
    const txns = [
      charge('CHATGPT SUBSCRIPTION CA', '2026-01-04', 21.4),
      charge('CHATGPT SUBSCRIPTION CA', '2026-02-04', 21.4),
      charge('NETFLIX COM CA', '2026-04-04', 15.49),
      charge('NETFLIX COM CA', '2026-05-04', 15.49),
    ];
    const subs = detectSubscriptions(txns, [
      { key: 'CHATGPT', included: true },
      { key: 'NETFLIX', included: false },
    ]);
    expect(subs.find((s) => s.key === 'CHATGPT')!.included).toBe(true);
    expect(subs.find((s) => s.key === 'NETFLIX')!.included).toBe(false);
    expect(subs.every((s) => s.confirmed)).toBe(true);
    expect(subscriptionMonthlyCents(subs)).toBe(2140);
  });

  it('ignores card purchases that are refunds or non-card rows', () => {
    const refund = { ...charge('NETFLIX COM CA', '2026-05-04', 15.49), amountCents: 1549 };
    const transfer: Txn = {
      ...charge('x', '2026-05-04', 25),
      descriptionRaw: 'Deposit from 360 Checking XXXXXXX4333',
    };
    expect(detectSubscriptions([refund, transfer])).toEqual([]);
  });
});

describe('subscriptionMonth', () => {
  const txns = [
    charge('NETFLIX COM CA', '2026-04-04', 15.49),
    charge('NETFLIX COM CA', '2026-05-04', 15.49),
    charge('SPOTIFY USA NY', '2026-03-20', 11.99),
    charge('SPOTIFY USA NY', '2026-04-20', 11.99),
  ];
  const subs = detectSubscriptions(txns);

  it('splits the month into charged and still to come', () => {
    const m = subscriptionMonth(subs, txns, '2026-05');
    expect(m.monthlyCents).toBe(1549 + 1199);
    expect(m.chargedCents).toBe(1549);
    expect(m.upcoming).toEqual([
      { key: 'SPOTIFY', name: 'Spotify', amountCents: 1199, dueDate: '2026-05-20' },
    ]);
  });

  it('rolls due dates forward for a month past the last statement', () => {
    const m = subscriptionMonth(subs, txns, '2026-08');
    expect(m.chargedCents).toBe(0);
    expect(m.upcoming.map((u) => u.dueDate)).toEqual(['2026-08-04', '2026-08-20']);
  });
});

describe('subscriptionForecastItems', () => {
  it('turns counted subscriptions into monthly bills', () => {
    const txns = [
      charge('NETFLIX COM CA', '2026-04-04', 15.49),
      charge('NETFLIX COM CA', '2026-05-04', 15.49),
    ];
    expect(subscriptionForecastItems(detectSubscriptions(txns))).toEqual([
      { direction: 'bill', cadence: 'monthly', anchorDate: '2026-05-04', amountCents: 1549 },
    ]);
  });
});

describe('against the real statements', () => {
  const { txns } = loadAllTxns();
  const subs = detectSubscriptions(txns);
  const key = (k: string) => subs.find((s) => s.key === k);

  it('finds the household subscriptions on the debit card', () => {
    expect(key('CLAUDE')?.amountCents).toBe(2140);
    expect(key('PLAYSTATION')?.amountCents).toBe(1062);
    expect(key('CANVA')?.amountCents).toBe(1605);
    expect(key('APPLE @3.02')?.amountCents).toBe(302);
    expect(key('APPLE @13.81')?.amountCents).toBe(1381);
    expect(subscriptionMonthlyCents(subs)).toBe(6490);
  });

  it('shows cancelled ones without counting them', () => {
    expect(key('CHATGPT')?.included).toBe(false);
  });

  it('does not mistake cafes, groceries or parking for subscriptions', () => {
    for (const s of subs) {
      expect(s.name).not.toMatch(/cafe|wholefds|cvs|parking|providence/i);
    }
  });
});
