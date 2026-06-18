export type Color = 'red' | 'green' | 'violet';
export type BetKind = 'color' | 'number';
export type RoundStatus = 'betting' | 'validating' | 'settled';
export type AppView = 'game' | 'wallet' | 'ledger';
export type LedgerTab = 'all' | 'topup' | 'deposit' | 'withdrawal' | 'winnings';

export type BetSelection =
  | { kind: 'color'; color: Color }
  | { kind: 'number'; number: number; color: Color };

export type Bet = {
  id: string;
  roundId: number;
  wallet: string;
  selection: BetSelection;
  amount: number;
  playableAmount: number;
  houseFee: number;
  maintenanceFee: number;
  createdAt: number;
  result?: 'pending' | 'won' | 'partial' | 'lost';
  payout?: number;
};

export type RoundSnapshot = {
  id: number;
  startsAt: number;
  bettingEndsAt: number;
  endsAt: number;
  status: RoundStatus;
  secondsLeft: number;
  bettingSecondsLeft: number;
};

export type PoolMap = Record<Color, number>;
export type NumberPoolMap = Record<number, number>;

export type RoundResult = {
  roundId: number;
  colorPools: PoolMap;
  numberPools: NumberPoolMap;
  winningColor: Color | null;
  winningNumber: number | null;
  tieBroken: boolean;
  reason: string;
  settledAt: number;
  finalHash: string;
};

export type WalletState = {
  connected: boolean;
  address: string;
  network: string;
  isDemo: boolean;
};

export type LedgerType =
  | 'topup_credit'
  | 'deposit_credit'
  | 'sell_debit'
  | 'withdrawal_debit'
  | 'winnings_credit'
  | 'bet_debit'
  | 'bet_loss'
  | 'fee_house'
  | 'fee_maintenance'
  | 'refund_credit';

export type LedgerEntry = {
  id: string;
  type: LedgerType;
  category: LedgerTab;
  amount: number;
  note: string;
  createdAt: number;
  roundId?: number;
  betId?: string;
};
