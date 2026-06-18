import type { Bet, LedgerEntry, RoundResult } from '../types';

const BALANCE_KEY = 'mindpool_gold_balance_v2';
const BETS_KEY = 'mindpool_bets_v2';
const RESULTS_KEY = 'mindpool_results_v2';
const LEDGER_KEY = 'mindpool_ledger_v2';

export function getBalance(): number {
  const saved = Number(localStorage.getItem(BALANCE_KEY));
  if (Number.isFinite(saved) && saved >= 0) return saved;
  localStorage.setItem(BALANCE_KEY, '0');
  return 0;
}

export function setBalance(value: number) {
  localStorage.setItem(BALANCE_KEY, String(Math.max(0, Math.round(value * 100) / 100)));
}

export function getBets(): Bet[] {
  return readJson<Bet[]>(BETS_KEY, []);
}

export function saveBets(bets: Bet[]) {
  localStorage.setItem(BETS_KEY, JSON.stringify(bets.slice(-120)));
}

export function getResults(): RoundResult[] {
  return readJson<RoundResult[]>(RESULTS_KEY, []);
}

export function saveResult(result: RoundResult) {
  const results = getResults();
  const exists = results.some((item) => item.roundId === result.roundId);
  if (!exists) {
    results.unshift(result);
    localStorage.setItem(RESULTS_KEY, JSON.stringify(results.slice(0, 40)));
  }
}

export function getLedger(): LedgerEntry[] {
  return readJson<LedgerEntry[]>(LEDGER_KEY, []);
}

export function appendLedger(entries: LedgerEntry[]) {
  const ledger = getLedger();
  localStorage.setItem(LEDGER_KEY, JSON.stringify([...entries, ...ledger].slice(0, 160)));
}

export function clearLocalAppData() {
  localStorage.removeItem(BALANCE_KEY);
  localStorage.removeItem(BETS_KEY);
  localStorage.removeItem(RESULTS_KEY);
  localStorage.removeItem(LEDGER_KEY);
}

function readJson<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;
  try {
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}
