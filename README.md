# MindPool Gold DApp

Educational TRON testnet DApp starter for a psychology-based lowest-pool prediction game.

## What this starter includes

- React + Vite + TypeScript frontend
- TronLink connect button with demo fallback
- Gold Coin in-app balance simulation
- Mock test-USDT deposit packages
- 60-second round timer
- 30-second betting window
- Color bets: Red, Green, Violet
- Exact number bets: 0-9
- Lowest eligible color pool wins
- Lowest eligible number inside winning color wins exact-number payout
- 10% total fee split: 5% house/test reserve + 5% app maintenance/test reserve
- Referral rule placeholder: L1 0.6%, L2 0.4%
- Local browser ledger and bet history
- Cloudflare Worker + D1 starter schema

## Testnet-only rule

This project is for DApp education only. It must stay on testnet/demo mode. Do not use this starter for real-money gambling, custody, mainnet funds, or production betting.

## Game rules

### Currency

- 1 mock test USDT = 100 Gold Coins
- Gameplay happens only with Gold Coins
- TRX/USDT transfers are mocked in this first starter

### Round timing

- 60 seconds per round
- 0-30 seconds: betting open
- 30-60 seconds: betting locked and result validation

### Bet options

Users can bet on:

- Red
- Green
- Violet
- Exact number 0,1,2,3,4,5,6,7,8,9

### Number mapping

- 0 = Violet
- 1,3,5,7,9 = Green
- 2,4,6,8 = Red

### Result algorithm

1. Direct color bets add to that color pool.
2. Exact number bets add to their parent color pool.
3. Colors with zero total pool are ignored.
4. The lowest eligible color pool wins.
5. Inside the winning color, exact-number pools are checked.
6. If one exact-number pool is lowest, that number wins.
7. If number pools are tied, a deterministic hash breaks the tie.
8. If no one bet any exact number inside the winning color, a display number is selected by hash, but no exact-number payout is generated.

### Payouts

Every bet:

- 90% playable amount
- 5% house/test reserve
- 5% app maintenance/test reserve

Color payout:

- Red = 2x playable amount
- Green = 2x playable amount
- Violet = 5x playable amount

Exact-number payout:

- Exact number = 9x playable amount

Number bets do not also receive color payout. They win only if the exact number wins.

### Referral model

- Level 1 = 0.6%
- Level 2 = 0.4%
- Paid from house/test reserve after settlement
- Only two levels

## Run frontend

```bash
cd mindpool-gold-dapp
npm install
npm run dev
```

Open:

```txt
http://localhost:5173
```

## Run Cloudflare Worker starter

```bash
cd worker
npm install
cp wrangler.toml.example wrangler.toml
```

Create D1 database:

```bash
npx wrangler d1 create mindpool_gold
```

Put the returned database ID into `wrangler.toml`, then initialize locally:

```bash
npm run d1:init
npm run dev
```

## Next build steps

1. Replace mock deposits with real Shasta/Nile test TRC20 USDT transfer verification.
2. Add wallet message-signature login.
3. Move local bet state into D1 API endpoints.
4. Add backend settlement job for each round.
5. Add public verification page for every settled round.
6. Add testnet withdrawal to TRC20 test USDT.
7. Add admin dashboard.
8. Add smart contract version after backend-first version is stable.

## Files to edit first

- `src/App.tsx` — UI and local demo flow
- `src/lib/gameEngine.ts` — full result algorithm and payout logic
- `worker/schema.sql` — D1 tables
- `worker/src/index.ts` — API starter


## Latest update
- Round timer is now 2 minutes.
- Betting is open for 90 seconds.
- Last 30 seconds are validation/result time.
- Game page includes Prediction Board with recent results and my last win/loss bets.


## Special Violet cover rule
- Red bet + result 0 returns 0.5x of original bet amount. Example: 10 coins returns 5 coins.
- Green bet + result 5 returns 0.5x of original bet amount. Example: 10 coins returns 5 coins.
- Violet bet + result 0/5 still gets 5x on playable amount.
- Exact number bet still gets 9x on playable amount.
