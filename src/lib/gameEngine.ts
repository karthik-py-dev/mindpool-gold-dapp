import type { Bet, Color, NumberPoolMap, PoolMap, RoundResult, RoundSnapshot } from '../types';

export const ROUND_MS = 120_000;
export const BETTING_MS = 90_000;

export const COLORS: Color[] = ['red', 'green', 'violet'];

export const NUMBER_TO_COLOR: Record<number, Color> = {
  0: 'violet',
  1: 'green',
  2: 'red',
  3: 'green',
  4: 'red',
  5: 'violet',
  6: 'red',
  7: 'green',
  8: 'red',
  9: 'green'
};

export const NUMBERS_BY_COLOR: Record<Color, number[]> = {
  red: [2, 4, 6, 8],
  green: [1, 3, 7, 9],
  violet: [0, 5]
};

export const COLOR_MULTIPLIER: Record<Color, number> = {
  red: 2,
  green: 2,
  violet: 5
};

export const NUMBER_MULTIPLIER = 9;
export const SPECIAL_COVER_MULTIPLIER = 0.5;

export const SPECIAL_COVER_NUMBER: Partial<Record<Color, number>> = {
  red: 0,
  green: 5
};

export function getRoundSnapshot(now = Date.now()): RoundSnapshot {
  const id = Math.floor(now / ROUND_MS);
  const startsAt = id * ROUND_MS;
  const bettingEndsAt = startsAt + BETTING_MS;
  const endsAt = startsAt + ROUND_MS;
  const status = now < bettingEndsAt ? 'betting' : now < endsAt ? 'validating' : 'settled';

  return {
    id,
    startsAt,
    bettingEndsAt,
    endsAt,
    status,
    secondsLeft: Math.max(0, Math.ceil((endsAt - now) / 1000)),
    bettingSecondsLeft: Math.max(0, Math.ceil((bettingEndsAt - now) / 1000))
  };
}

export function calculateFees(amount: number) {
  return {
    playableAmount: round2(amount * 0.9),
    houseFee: round2(amount * 0.05),
    maintenanceFee: round2(amount * 0.05)
  };
}

export function getSelectionLabel(bet: Pick<Bet, 'selection'>): string {
  if (bet.selection.kind === 'color') return bet.selection.color.toUpperCase();
  return `#${bet.selection.number}`;
}

export function buildPools(roundId: number, bets: Bet[], includeDemoCrowd = true) {
  const colorPools: PoolMap = { red: 0, green: 0, violet: 0 };
  const numberPools: NumberPoolMap = makeEmptyNumberPools();

  const demo = includeDemoCrowd ? generateDemoCrowd(roundId) : [];
  const allBets = [...demo, ...bets.filter((bet) => bet.roundId === roundId)];

  for (const bet of allBets) {
    if (bet.selection.kind === 'color') {
      colorPools[bet.selection.color] += bet.amount;
    } else {
      numberPools[bet.selection.number] += bet.amount;
      colorPools[bet.selection.color] += bet.amount;
    }
  }

  return {
    colorPools: roundPoolMap(colorPools),
    numberPools: roundNumberPoolMap(numberPools),
    allBets
  };
}

export function settleRound(roundId: number, bets: Bet[], includeDemoCrowd = true): RoundResult {
  const { colorPools, numberPools } = buildPools(roundId, bets, includeDemoCrowd);
  const seed = `mindpool:${roundId}:${JSON.stringify(colorPools)}:${JSON.stringify(numberPools)}`;
  const finalHash = hashString(seed).toString(16).padStart(8, '0');

  const winningColor = chooseLowestColor(colorPools, finalHash);
  if (!winningColor) {
    return {
      roundId,
      colorPools,
      numberPools,
      winningColor: null,
      winningNumber: null,
      tieBroken: false,
      reason: 'No eligible bets were placed in this round.',
      settledAt: Date.now(),
      finalHash
    };
  }

  const numberChoice = chooseWinningNumber(winningColor, numberPools, finalHash);

  return {
    roundId,
    colorPools,
    numberPools,
    winningColor,
    winningNumber: numberChoice.number,
    tieBroken: numberChoice.tieBroken,
    reason: numberChoice.reason,
    settledAt: Date.now(),
    finalHash
  };
}

export function settleBet(bet: Bet, result: RoundResult): Bet {
  if (!result.winningColor || result.winningNumber === null) {
    return { ...bet, result: 'lost', payout: 0 };
  }

  if (bet.selection.kind === 'color') {
    const fullWin = bet.selection.color === result.winningColor;

    if (fullWin) {
      const payout = round2(bet.playableAmount * COLOR_MULTIPLIER[bet.selection.color]);
      return { ...bet, result: 'won', payout };
    }

    const coverNumber = SPECIAL_COVER_NUMBER[bet.selection.color];
    const hasSpecialCover = coverNumber !== undefined && result.winningNumber === coverNumber;

    if (hasSpecialCover) {
      const payout = round2(bet.amount * SPECIAL_COVER_MULTIPLIER);
      return { ...bet, result: 'partial', payout };
    }

    return { ...bet, result: 'lost', payout: 0 };
  }

  const won = bet.selection.number === result.winningNumber;
  const payout = won ? round2(bet.playableAmount * NUMBER_MULTIPLIER) : 0;
  return { ...bet, result: won ? 'won' : 'lost', payout };
}

export function getActivityLabel(amount: number, maxAmount: number): string {
  if (maxAmount <= 0 || amount <= 0) return 'Silent';
  const ratio = amount / maxAmount;
  if (ratio >= 0.75) return 'Hot';
  if (ratio >= 0.4) return 'Active';
  return 'Quiet';
}

function chooseLowestColor(colorPools: PoolMap, hash: string): Color | null {
  const eligible = Object.entries(colorPools)
    .filter(([, amount]) => amount > 0)
    .map(([color, amount]) => ({ color: color as Color, amount }));

  if (eligible.length === 0) return null;

  const min = Math.min(...eligible.map((item) => item.amount));
  const tied = eligible.filter((item) => item.amount === min).map((item) => item.color);

  if (tied.length === 1) return tied[0];
  return tied[hashString(`${hash}:colorTie`) % tied.length];
}

function chooseWinningNumber(color: Color, numberPools: NumberPoolMap, hash: string) {
  const numbers = NUMBERS_BY_COLOR[color];
  const eligible = numbers
    .map((number) => ({ number, amount: numberPools[number] ?? 0 }))
    .filter((item) => item.amount > 0);

  if (eligible.length === 0) {
    const number = numbers[hashString(`${hash}:fallbackNumber`) % numbers.length];
    return {
      number,
      tieBroken: false,
      reason: `No exact-number bets existed inside ${color}. A display number was selected by hash.`
    };
  }

  const min = Math.min(...eligible.map((item) => item.amount));
  const tied = eligible.filter((item) => item.amount === min).map((item) => item.number);

  if (tied.length === 1) {
    return {
      number: tied[0],
      tieBroken: false,
      reason: `Lowest exact-number pool inside ${color} won.`
    };
  }

  return {
    number: tied[hashString(`${hash}:numberTie`) % tied.length],
    tieBroken: true,
    reason: `Exact-number tie inside ${color}; hash tiebreaker selected the final number.`
  };
}

function generateDemoCrowd(roundId: number): Bet[] {
  const seed = hashString(`crowd:${roundId}`);
  const bets: Bet[] = [];
  const crowdCount = 10 + (seed % 14);

  for (let i = 0; i < crowdCount; i += 1) {
    const localSeed = hashString(`${roundId}:${i}:${seed}`);
    const amount = 25 + (localSeed % 16) * 10;
    const useNumber = localSeed % 100 < 50;

    if (useNumber) {
      const number = localSeed % 10;
      const color = NUMBER_TO_COLOR[number];
      const fees = calculateFees(amount);
      bets.push({
        id: `demo_number_${roundId}_${i}`,
        roundId,
        wallet: `DEMO_${i}`,
        selection: { kind: 'number', number, color },
        amount,
        ...fees,
        createdAt: roundId * ROUND_MS + i
      });
    } else {
      const color = COLORS[localSeed % COLORS.length];
      const fees = calculateFees(amount);
      bets.push({
        id: `demo_color_${roundId}_${i}`,
        roundId,
        wallet: `DEMO_${i}`,
        selection: { kind: 'color', color },
        amount,
        ...fees,
        createdAt: roundId * ROUND_MS + i
      });
    }
  }

  return bets;
}

function makeEmptyNumberPools(): NumberPoolMap {
  return Array.from({ length: 10 }).reduce<NumberPoolMap>((acc, _, index) => {
    acc[index] = 0;
    return acc;
  }, {});
}

function roundPoolMap(pool: PoolMap): PoolMap {
  return {
    red: round2(pool.red),
    green: round2(pool.green),
    violet: round2(pool.violet)
  };
}

function roundNumberPoolMap(pool: NumberPoolMap): NumberPoolMap {
  const next = makeEmptyNumberPools();
  for (const [number, amount] of Object.entries(pool)) {
    next[Number(number)] = round2(amount);
  }
  return next;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hashString(input: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return Math.abs(4294967296 * (2097151 & h2) + (h1 >>> 0));
}
