import type {
  Bet,
  BetSelection,
  Color,
  LedgerEntry,
  LedgerTab,
  LedgerType,
  RoundResult,
  RoundSnapshot
} from "../types";
const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

type ApiBalance = {
  available_balance: number;
  locked_balance: number;
};

type ApiLedgerRow = {
  id: string;
  type: string;
  amount: number;
  note: string;
  round_id?: number;
  bet_id?: string;
  created_at?: string;
};

type ApiResultRow = {
  id: string;
  round_id: number;
  winning_color: Color | null;
  winning_number: number | null;
  final_hash: string;
  reason: string;
  created_at?: string;
};

type ApiBetRow = {
  id: string;
  round_id: number;
  wallet_address: string;
  kind: "color" | "number";
  color: Color;
  number: number | null;
  amount: number;
  playable_amount: number;
  status?: "pending" | "settled";
  result?: "won" | "partial" | "lost" | null;
  payout_amount?: number | null;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_URL) {
    throw new Error("Missing VITE_API_URL in .env.local");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || "API request failed");
  }

  return data as T;
}

export async function apiRegister(walletAddress: string, referrerCode?: string) {
  return request<{
    ok: boolean;
    walletAddress: string;
    referralCode: string;
    balance: ApiBalance;
  }>("/api/register", {
    method: "POST",
    body: JSON.stringify({ walletAddress, referrerCode }),
  });
}

export async function apiGetBalance(walletAddress: string) {
  const data = await request<{
    ok: boolean;
    walletAddress: string;
    balance: ApiBalance;
  }>(`/api/balance?walletAddress=${encodeURIComponent(walletAddress)}`);

  return data.balance;
}

export async function apiDeposit(walletAddress: string, testUsdtAmount: number) {
  return request<{
    ok: boolean;
    depositId: string;
    creditedGoldCoins: number;
    balance: ApiBalance;
  }>("/api/mock-deposit", {
    method: "POST",
    body: JSON.stringify({ walletAddress, testUsdtAmount }),
  });
}

export async function apiCurrentRound(): Promise<RoundSnapshot> {
  const data = await request<{
    roundId: number;
    status: "betting" | "validating";
    startsAt: number;
    bettingEndsAt: number;
    validationStartsAt?: number;
    endsAt: number;
    secondsLeft: number;
    bettingSecondsLeft: number;
    validationSecondsLeft: number;
  }>("/api/current-round");

  return {
    id: data.roundId,
    status: data.status,
    startsAt: data.startsAt,
    bettingEndsAt: data.bettingEndsAt,
    endsAt: data.endsAt,
    secondsLeft: data.secondsLeft,
    bettingSecondsLeft: data.bettingSecondsLeft,
    validationSecondsLeft: data.validationSecondsLeft,
  };
}
export async function apiAuthNonce(walletAddress: string) {
  return request<{
    ok: boolean;
    walletAddress: string;
    nonceId: string;
    message: string;
    plainMessage: string;
    expiresAt: number;
  }>("/api/auth/nonce", {
    method: "POST",
    body: JSON.stringify({ walletAddress }),
  });
}

export async function apiAuthVerify(input: {
  walletAddress: string;
  nonceId: string;
  message: string;
  signature: string;
  referrerCode?: string;
}) {
  return request<{
    ok: boolean;
    walletAddress: string;
    sessionToken: string;
    expiresAt: number;
    appWalletAddress: string;
    referralCode: string;
    balance: {
      available_balance: number;
      locked_balance: number;
    };
  }>("/api/auth/verify", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function apiAuthMe(sessionToken: string) {
  return request<{
    ok: boolean;
    walletAddress: string;
    appWalletAddress: string;
    referralCode: string;
    balance: {
      available_balance: number;
      locked_balance: number;
    };
  }>("/api/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
}
export async function apiPlaceBet(input: {
  walletAddress: string;
  roundId: number;
  selection: BetSelection;
  amount: number;
}) {
  const body =
    input.selection.kind === "number"
      ? {
          walletAddress: input.walletAddress,
          roundId: input.roundId,
          kind: "number",
          number: input.selection.number,
          amount: input.amount,
        }
      : {
          walletAddress: input.walletAddress,
          roundId: input.roundId,
          kind: "color",
          color: input.selection.color,
          amount: input.amount,
        };

  return request<{
    ok: boolean;
    betId: string;
    roundId: number;
    amount: number;
    playable: number;
    house: number;
    maintenance: number;
    balance: ApiBalance;
  }>("/api/place-bet", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiSettleRound(roundId: number) {
  return request<{
    ok: boolean;
    alreadySettled?: boolean;
    result?: unknown;
    settledBets?: number;
  }>("/api/settle-round", {
    method: "POST",
    body: JSON.stringify({ roundId }),
  });
}

export async function apiGetLedger(walletAddress: string): Promise<LedgerEntry[]> {
  const data = await request<{
    ok: boolean;
    walletAddress: string;
    ledger: ApiLedgerRow[];
  }>(`/api/ledger?walletAddress=${encodeURIComponent(walletAddress)}`);

  return data.ledger.map(mapLedgerRow);
}

export async function apiGetResults(): Promise<RoundResult[]> {
  const data = await request<{
    ok: boolean;
    results: ApiResultRow[];
  }>("/api/results");

  return data.results.map((row) => ({
    roundId: row.round_id,
    colorPools: { red: 0, green: 0, violet: 0 },
    numberPools: {
      0: 0,
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
      6: 0,
      7: 0,
      8: 0,
      9: 0,
    },
    winningColor: row.winning_color,
    winningNumber: row.winning_number,
    tieBroken: false,
    reason: row.reason,
    settledAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
    finalHash: row.final_hash,
  }));
}

export async function apiGetRoundBets(roundId: number): Promise<Bet[]> {
  const data = await request<{
    ok: boolean;
    roundId: number;
    bets: ApiBetRow[];
  }>(`/api/round-bets?roundId=${roundId}`);

  return data.bets.map(mapBetRow);
}
function getSessionToken(): string {
  return localStorage.getItem("mindpool_session") || "";
}

function mapBetRow(row: ApiBetRow): Bet {
  const selection: BetSelection =
    row.kind === "number"
      ? { kind: "number", number: Number(row.number), color: row.color }
      : { kind: "color", color: row.color };

  return {
    id: row.id,
    roundId: row.round_id,
    wallet: row.wallet_address,
    selection,
    amount: row.amount,
    playableAmount: row.playable_amount,
    houseFee: row.amount * 0.05,
    maintenanceFee: row.amount * 0.05,
    createdAt: Date.now(),
    result: row.status === "settled" ? row.result || "lost" : "pending",
    payout: row.payout_amount || 0,
  };
}

function mapLedgerRow(row: ApiLedgerRow): LedgerEntry {
  const type = mapLedgerType(row.type);

  return {
    id: row.id,
    type,
    category: getCategory(type),
    amount: Number(row.amount || 0),
    note: row.note || row.type,
    roundId: row.round_id,
    betId: row.bet_id,
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
}

function mapLedgerType(type: string): LedgerType {
  if (type === "bet_lock") return "bet_debit";
  if (type === "special_cover_credit") return "winnings_credit";
  if (type === "deposit_credit") return "deposit_credit";
  if (type === "winnings_credit") return "winnings_credit";
  if (type === "fee_house") return "fee_house";
  if (type === "fee_maintenance") return "fee_maintenance";
  if (type === "bet_loss") return "bet_loss";
  if (type === "withdrawal_debit") return "withdrawal_debit";
  if (type === "sell_debit") return "sell_debit";
  return "topup_credit";
}

function getCategory(type: LedgerType): LedgerTab {
  if (type === "deposit_credit") return "deposit";
  if (type === "topup_credit") return "topup";
  if (type === "winnings_credit") return "winnings";
  if (type === "withdrawal_debit" || type === "sell_debit") return "withdrawal";
  return "all";
}
export type RoundStats = {
  roundId: number;
  totalBets: number;
  colorCounts: Record<Color, number>;
  numberCounts: Record<number, number>;
};

export async function apiGetRoundStats(roundId: number): Promise<RoundStats> {
  const data = await request<{
    ok: boolean;
    roundId: number;
    totalBets: number;
    colorCounts: Record<Color, number>;
    numberCounts: Record<number, number>;
  }>(`/api/round-stats?roundId=${roundId}`);

  return {
    roundId: data.roundId,
    totalBets: data.totalBets,
    colorCounts: data.colorCounts,
    numberCounts: data.numberCounts,
  };
}

export async function apiGetReferralEarnings(walletAddress: string) {
  return request<{
    ok: boolean;
    walletAddress: string;
    earnings: {
      id: string;
      from_wallet_address: string;
      level: number;
      bet_id: string;
      round_id: number;
      commission_amount: number;
      created_at: string;
    }[];
  }>(`/api/referral-earnings?walletAddress=${encodeURIComponent(walletAddress)}`);
}

export type WalletSummary = {
  walletAddress: string;
  gold: {
    available: number;
    locked: number;
    totalBought: number;
    totalSold: number;
  };
  usdt: {
    totalBought: number;
    availableForWithdrawal: number;
    withdrawn: number;
    readyFromSales: number;
  };
  rate: {
    testUsdtToGold: string;
    goldToTestUsdt: string;
  };
};

export async function apiWalletSummary() {
  const sessionToken = getSessionToken();

  return request<WalletSummary>("/api/wallet-summary", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });
}


export async function apiSellCoins(goldCoinAmount: number) {
  const sessionToken = getSessionToken();

  return request<{
    ok: boolean;
    walletAddress: string;
    soldGoldCoins: number;
    readyForWithdrawalTestUsdt: number;
    balance: {
      available_balance: number;
      locked_balance: number;
    };
  }>("/api/sell-coins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ goldCoinAmount }),
  });
}
export async function apiWithdrawTestUsdt(testUsdtAmount: number) {
  const sessionToken = localStorage.getItem("mindpool_session") || "";

  return request<{
    ok: boolean;
    withdrawalId: string;
    walletAddress: string;
    withdrawnTestUsdt: number;
  }>("/api/withdraw-test-usdt", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ testUsdtAmount }),
  });
}