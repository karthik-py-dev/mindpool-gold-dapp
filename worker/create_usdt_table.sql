CREATE TABLE IF NOT EXISTS test_usdt_balances (
  wallet_address TEXT PRIMARY KEY,
  available_usdt REAL NOT NULL DEFAULT 0,
  withdrawn_usdt REAL NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
