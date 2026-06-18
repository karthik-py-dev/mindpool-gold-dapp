-- MindPool Gold DApp - Cloudflare D1 schema
-- TESTNET / EDUCATIONAL ONLY

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL UNIQUE,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coin_balances (
  wallet_address TEXT PRIMARY KEY,
  available_balance REAL NOT NULL DEFAULT 0,
  locked_balance REAL NOT NULL DEFAULT 0,
  winnings_balance REAL NOT NULL DEFAULT 0,
  referral_balance REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coin_ledger (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'all',
  amount REAL NOT NULL,
  note TEXT NOT NULL,
  round_id INTEGER,
  bet_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  test_usdt_amount REAL NOT NULL,
  gold_coin_amount REAL NOT NULL,
  tx_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'mock_pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  gold_coin_amount REAL NOT NULL,
  test_usdt_amount REAL NOT NULL,
  tx_hash TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'mock_pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY,
  status TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  betting_ends_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  winning_color TEXT,
  winning_number INTEGER,
  final_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TEXT
);

CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  round_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL,
  kind TEXT NOT NULL,
  color TEXT NOT NULL,
  number INTEGER,
  amount REAL NOT NULL,
  playable_amount REAL NOT NULL,
  house_fee REAL NOT NULL,
  maintenance_fee REAL NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending',
  payout REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_earnings (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL,
  round_id INTEGER NOT NULL,
  player_wallet TEXT NOT NULL,
  referrer_wallet TEXT NOT NULL,
  level INTEGER NOT NULL,
  commission_percent REAL NOT NULL,
  commission_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bets_round ON bets(round_id);
CREATE INDEX IF NOT EXISTS idx_ledger_wallet ON coin_ledger(wallet_address);
CREATE INDEX IF NOT EXISTS idx_referral_player ON referral_earnings(player_wallet);
