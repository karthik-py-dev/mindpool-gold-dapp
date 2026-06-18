export interface Env {
  DB: D1Database;
}

type Color = 'red' | 'green' | 'violet';

const NUMBER_TO_COLOR: Record<number, Color> = {
  0: 'violet',
  1: 'green',
  2: 'red',
  3: 'green',
  4: 'red',
  5: 'green',
  6: 'red',
  7: 'green',
  8: 'red',
  9: 'green'
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);

    try {
      if (url.pathname === '/health') {
        return json({ ok: true, app: 'MindPool Gold Worker', mode: 'testnet-educational' });
      }

      if (url.pathname === '/api/rules') {
        return json({
          network: 'TRON testnet only',
          currency: 'Gold Coins',
          deposit: 'mock TRC20 test USDT',
          rate: '1 test USDT = 100 Gold Coins',
          fees: { playable: 0.9, house: 0.05, maintenance: 0.05 },
          referral: { level1: 0.006, level2: 0.004 },
          colors: { red: [2, 4, 6, 8], green: [1, 3, 5, 7, 9], violet: [0] },
          payout: { red: 2, green: 2, violet: 5, exactNumber: 9 },
          result: 'lowest eligible color pool wins; lowest eligible number inside winning color wins exact-number payout'
        });
      }

      if (url.pathname === '/api/register' && request.method === 'POST') {
        const body = await request.json() as { walletAddress?: string; referrerCode?: string };
        if (!body.walletAddress) return json({ error: 'walletAddress is required' }, 400);
        const referralCode = makeReferralCode(body.walletAddress);
        await env.DB.prepare(
          `INSERT OR IGNORE INTO users (id, wallet_address, referral_code, referred_by_code) VALUES (?, ?, ?, ?)`
        ).bind(id('user'), body.walletAddress, referralCode, body.referrerCode || null).run();
        await env.DB.prepare(
          `INSERT OR IGNORE INTO coin_balances (wallet_address, available_balance) VALUES (?, 0)`
        ).bind(body.walletAddress).run();
        return json({ walletAddress: body.walletAddress, referralCode });
      }

      if (url.pathname === '/api/mock-deposit' && request.method === 'POST') {
        const body = await request.json() as { walletAddress?: string; testUsdtAmount?: number };
        if (!body.walletAddress || !body.testUsdtAmount) return json({ error: 'walletAddress and testUsdtAmount are required' }, 400);
        const coins = round2(body.testUsdtAmount * 100);
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO deposits (id, wallet_address, test_usdt_amount, gold_coin_amount, status) VALUES (?, ?, ?, ?, 'mock_completed')`)
            .bind(id('dep'), body.walletAddress, body.testUsdtAmount, coins),
          env.DB.prepare(`UPDATE coin_balances SET available_balance = available_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_address = ?`)
            .bind(coins, body.walletAddress),
          env.DB.prepare(`INSERT INTO coin_ledger (id, wallet_address, type, amount, note) VALUES (?, ?, 'deposit_credit', ?, ?)`)
            .bind(id('ledger'), body.walletAddress, coins, `Mock test-USDT deposit: ${body.testUsdtAmount}`)
        ]);
        return json({ creditedGoldCoins: coins });
      }

      if (url.pathname === '/api/place-bet' && request.method === 'POST') {
        const body = await request.json() as { walletAddress?: string; roundId?: number; kind?: 'color' | 'number'; color?: Color; number?: number; amount?: number };
        if (!body.walletAddress || !body.roundId || !body.kind || !body.amount) return json({ error: 'Missing required fields' }, 400);

        const color = body.kind === 'number' ? NUMBER_TO_COLOR[Number(body.number)] : body.color;
        if (!color) return json({ error: 'Invalid color/number selection' }, 400);

        const amount = round2(body.amount);
        const playable = round2(amount * 0.9);
        const house = round2(amount * 0.05);
        const maintenance = round2(amount * 0.05);
        const betId = id('bet');

        const balanceRow = await env.DB.prepare(`SELECT available_balance FROM coin_balances WHERE wallet_address = ?`).bind(body.walletAddress).first<{ available_balance: number }>();
        if (!balanceRow || balanceRow.available_balance < amount) return json({ error: 'Insufficient Gold Coin balance' }, 400);

        await env.DB.batch([
          env.DB.prepare(`UPDATE coin_balances SET available_balance = available_balance - ?, locked_balance = locked_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE wallet_address = ?`)
            .bind(amount, playable, body.walletAddress),
          env.DB.prepare(`INSERT INTO bets (id, round_id, wallet_address, kind, color, number, amount, playable_amount, house_fee, maintenance_fee) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(betId, body.roundId, body.walletAddress, body.kind, color, body.kind === 'number' ? body.number : null, amount, playable, house, maintenance),
          env.DB.prepare(`INSERT INTO coin_ledger (id, wallet_address, type, amount, note, round_id, bet_id) VALUES (?, ?, 'bet_lock', ?, ?, ?, ?)`)
            .bind(id('ledger'), body.walletAddress, amount, `Bet placed on ${body.kind === 'number' ? '#' + body.number : color}`, body.roundId, betId),
          env.DB.prepare(`INSERT INTO coin_ledger (id, wallet_address, type, amount, note, round_id, bet_id) VALUES (?, ?, 'fee_house', ?, '5% house/test reserve fee', ?, ?)`)
            .bind(id('ledger'), body.walletAddress, house, body.roundId, betId),
          env.DB.prepare(`INSERT INTO coin_ledger (id, wallet_address, type, amount, note, round_id, bet_id) VALUES (?, ?, 'fee_maintenance', ?, '5% app maintenance/test reserve fee', ?, ?)`)
            .bind(id('ledger'), body.walletAddress, maintenance, body.roundId, betId)
        ]);

        return json({ betId, amount, playable, house, maintenance });
      }

      return json({ error: 'Not found' }, 404);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
    }
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeReferralCode(wallet: string): string {
  return `MP${wallet.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}`;
}
