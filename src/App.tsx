import { useEffect, useMemo, useState } from 'react';
import type { AppView, Bet, BetSelection, LedgerEntry, LedgerTab, LedgerType, RoundResult, WalletState } from './types';
import {
  buildPools,
  calculateFees,
  COLOR_MULTIPLIER,
  COLORS,
  getActivityLabel,
  getRoundSnapshot,
  getSelectionLabel,
  NUMBER_MULTIPLIER,
  NUMBER_TO_COLOR,
  SPECIAL_COVER_MULTIPLIER,
  SPECIAL_COVER_NUMBER,
  settleBet,
  settleRound
} from './lib/gameEngine';
import { clearWallet, connectTronLink, getSavedWallet } from './lib/wallet';
import { appendLedger, clearLocalAppData, getBalance, getBets, getLedger, getResults, saveBets, saveResult, setBalance } from './lib/storage';
import { clampAmount, formatCoins, makeId, shortAddress } from './lib/utils';

const defaultWallet: WalletState = getSavedWallet();

const BUY_PACKAGES = [5, 10, 25, 50];
const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];
const LEDGER_TABS: { id: LedgerTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'topup', label: 'Topup' },
  { id: 'deposit', label: 'Deposit' },
  { id: 'withdrawal', label: 'Withdraw' },
  { id: 'winnings', label: 'Wins' }
];

const BOTTOM_NAV: { id: AppView; label: string; icon: string }[] = [
  { id: 'game', label: 'Game', icon: '🎮' },
  { id: 'ledger', label: 'Transactions', icon: '↕' },
  { id: 'wallet', label: 'Wallet', icon: '👛' }
];

const DEBIT_TYPES: LedgerType[] = ['sell_debit', 'withdrawal_debit', 'bet_debit', 'bet_loss', 'fee_house', 'fee_maintenance'];
const CREDIT_TYPES: LedgerType[] = ['topup_credit', 'deposit_credit', 'winnings_credit', 'refund_credit'];

export default function App() {
  const [wallet, setWallet] = useState<WalletState>(defaultWallet);
  const [view, setView] = useState<AppView>('game');
  const [balance, setGoldBalance] = useState(() => getBalance());
  const [bets, setBets] = useState<Bet[]>(() => getBets());
  const [results, setResults] = useState<RoundResult[]>(() => getResults());
  const [ledger, setLedger] = useState<LedgerEntry[]>(() => getLedger());
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('all');
  const [now, setNow] = useState(Date.now());
  const [selection, setSelection] = useState<BetSelection>({ kind: 'color', color: 'green' });
  const [amount, setAmount] = useState(100);
  const [walletAmount, setWalletAmount] = useState(1000);
  const [message, setMessage] = useState('Educational TRON testnet build. No real money.');

  const round = useMemo(() => getRoundSnapshot(now), [now]);
  const currentRoundBets = useMemo(() => bets.filter((bet) => bet.roundId === round.id), [bets, round.id]);
  const lastResult = results[0];
  const pools = useMemo(() => buildPools(round.id, bets, true), [round.id, bets]);
  const maxPool = Math.max(...COLORS.map((color) => pools.colorPools[color]), 0);
  const selectedLabel = selection.kind === 'color' ? selection.color.toUpperCase() : `#${selection.number}`;
  const selectedMultiplier = selection.kind === 'color' ? COLOR_MULTIPLIER[selection.color] : NUMBER_MULTIPLIER;
  const specialCoverNumber = selection.kind === 'color' ? SPECIAL_COVER_NUMBER[selection.color] : undefined;
  const feePreview = calculateFees(clampAmount(amount));
  const myPendingBet = currentRoundBets.find((bet) => bet.wallet === wallet.address && bet.result === 'pending');
  const filteredLedger = ledgerTab === 'all' ? ledger : ledger.filter((entry) => entry.category === ledgerTab);
  const recentResults = results.slice(0, 10);
  const myRecentBets = bets
    .filter((bet) => bet.wallet === wallet.address)
    .slice()
    .reverse()
    .slice(0, 5);

  const walletStats = useMemo(() => {
    return {
      totalTopup: sumLedger(ledger, ['topup_credit', 'deposit_credit']),
      totalWins: sumLedger(ledger, ['winnings_credit']),
      totalWithdrawals: sumLedger(ledger, ['sell_debit', 'withdrawal_debit']),
      totalSpent: sumLedger(ledger, ['bet_debit'])
    };
  }, [ledger]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (round.status !== 'validating') return;
    const alreadySettled = results.some((result) => result.roundId === round.id);
    if (alreadySettled) return;

    const result = settleRound(round.id, bets, true);
    const settledBets = bets.map((bet) => (bet.roundId === round.id ? settleBet(bet, result) : bet));
    const mySettledBets = settledBets.filter((bet) => bet.roundId === round.id && bet.wallet === wallet.address && bet.result);
    const payoutTotal = mySettledBets.reduce((sum, bet) => sum + (bet.payout ?? 0), 0);

    if (payoutTotal > 0) {
      setGoldBalance((prev) => {
        const next = prev + payoutTotal;
        setBalance(next);
        return next;
      });
    }

    const newLedger = mySettledBets.map<LedgerEntry>((bet) => {
      if ((bet.payout ?? 0) > 0) {
        return {
          id: makeId('ledger'),
          type: 'winnings_credit',
          category: 'winnings',
          amount: bet.payout ?? 0,
          note: `${bet.result === 'partial' ? 'Special cover' : 'Won'} on ${getSelectionLabel(bet)} · Round #${round.id}`,
          roundId: round.id,
          betId: bet.id,
          createdAt: Date.now()
        };
      }
      return {
        id: makeId('ledger'),
        type: 'bet_loss',
        category: 'all',
        amount: bet.playableAmount,
        note: `Lost on ${getSelectionLabel(bet)} · Round #${round.id}`,
        roundId: round.id,
        betId: bet.id,
        createdAt: Date.now()
      };
    });

    if (newLedger.length) appendLedger(newLedger);
    saveBets(settledBets);
    saveResult(result);
    setBets(settledBets);
    setResults(getResults());
    setLedger(getLedger());
  }, [round.status, round.id, bets, results, wallet.address]);

  async function handleConnect() {
    const connected = await connectTronLink();
    setWallet(connected);
    setMessage(connected.isDemo ? 'Demo wallet connected. Install TronLink later for real testnet signing.' : 'Wallet connected to testnet.');
  }

  function handleDisconnect() {
    clearWallet();
    setWallet({ connected: false, address: '', network: 'Not connected', isDemo: false });
    setMessage('Wallet disconnected.');
  }

  function syncBalance(next: number) {
    setBalance(next);
    setGoldBalance(next);
  }

  function handleBuyCoins(usdt: number) {
    if (!wallet.connected) {
      setMessage('Connect wallet before buying demo coins.');
      return;
    }
    const coins = usdt * 100;
    const nextBalance = balance + coins;
    syncBalance(nextBalance);
    appendLedger([
      {
        id: makeId('ledger'),
        type: 'topup_credit',
        category: 'topup',
        amount: coins,
        note: `Buy coins: ${usdt} test USDT → ${coins} Gold Coins`,
        createdAt: Date.now()
      },
      {
        id: makeId('ledger'),
        type: 'deposit_credit',
        category: 'deposit',
        amount: coins,
        note: `Deposit ledger: ${usdt} test USDT package confirmed`,
        createdAt: Date.now()
      }
    ]);
    setLedger(getLedger());
    setMessage(`Added ${formatCoins(coins)} Gold Coins.`);
  }

  function handleSellCoins() {
    if (!wallet.connected) {
      setMessage('Connect wallet before selling coins.');
      return;
    }
    const safeAmount = clampAmount(walletAmount);
    if (safeAmount <= 0 || safeAmount > balance) {
      setMessage('Enter a valid sell amount within your Gold Coin balance.');
      return;
    }
    const usdt = safeAmount / 100;
    const nextBalance = balance - safeAmount;
    syncBalance(nextBalance);
    appendLedger([
      {
        id: makeId('ledger'),
        type: 'sell_debit',
        category: 'withdrawal',
        amount: safeAmount,
        note: `Sell coins: ${safeAmount} coins → ${usdt.toFixed(2)} test USDT`,
        createdAt: Date.now()
      }
    ]);
    setLedger(getLedger());
    setMessage(`Sold ${formatCoins(safeAmount)} coins in demo mode.`);
  }

  function handleWithdrawCoins() {
    if (!wallet.connected) {
      setMessage('Connect wallet before withdrawal.');
      return;
    }
    const safeAmount = clampAmount(walletAmount);
    if (safeAmount <= 0 || safeAmount > balance) {
      setMessage('Enter a valid withdraw amount within your Gold Coin balance.');
      return;
    }
    const usdt = safeAmount / 100;
    const nextBalance = balance - safeAmount;
    syncBalance(nextBalance);
    appendLedger([
      {
        id: makeId('ledger'),
        type: 'withdrawal_debit',
        category: 'withdrawal',
        amount: safeAmount,
        note: `Withdraw request: ${safeAmount} coins → ${usdt.toFixed(2)} test USDT to ${shortAddress(wallet.address)}`,
        createdAt: Date.now()
      }
    ]);
    setLedger(getLedger());
    setMessage(`Withdrawal ledger added for ${formatCoins(safeAmount)} coins.`);
  }

  function handlePlaceBet() {
    if (!wallet.connected) {
      setMessage('Connect wallet before placing a bet.');
      return;
    }
    if (round.status !== 'betting') {
      setMessage('Betting is closed. Wait for the next round.');
      return;
    }

    const safeAmount = clampAmount(amount);
    if (safeAmount <= 0 || safeAmount > balance) {
      setMessage('Not enough Gold Coins. Buy coins first.');
      return;
    }

    const fees = calculateFees(safeAmount);
    const bet: Bet = {
      id: makeId('bet'),
      roundId: round.id,
      wallet: wallet.address,
      selection,
      amount: safeAmount,
      ...fees,
      createdAt: Date.now(),
      result: 'pending'
    };

    const nextBalance = balance - safeAmount;
    const nextBets = [...bets, bet];
    const entries: LedgerEntry[] = [
      {
        id: makeId('ledger'),
        type: 'bet_debit',
        category: 'all',
        amount: safeAmount,
        note: `Bet on ${getSelectionLabel(bet)} · Round #${round.id}`,
        roundId: round.id,
        betId: bet.id,
        createdAt: Date.now()
      },
      {
        id: makeId('ledger'),
        type: 'fee_house',
        category: 'all',
        amount: fees.houseFee,
        note: '5% house/test reserve fee',
        roundId: round.id,
        betId: bet.id,
        createdAt: Date.now()
      },
      {
        id: makeId('ledger'),
        type: 'fee_maintenance',
        category: 'all',
        amount: fees.maintenanceFee,
        note: '5% app maintenance/test reserve fee',
        roundId: round.id,
        betId: bet.id,
        createdAt: Date.now()
      }
    ];

    syncBalance(nextBalance);
    saveBets(nextBets);
    appendLedger(entries);
    setBets(nextBets);
    setLedger(getLedger());
    setMessage(`Bet placed: ${formatCoins(safeAmount)} coins on ${getSelectionLabel(bet)}.`);
  }

  function resetDemo() {
    clearLocalAppData();
    syncBalance(getBalance());
    setBets([]);
    setResults([]);
    setLedger([]);
    setMessage('Demo ledgers and bets reset.');
  }

  if (!wallet.connected) {
    return (
      <main className="auth-stage">
        <section className="auth-card">
          <div className="brand-mark">MP</div>
          <p className="eyebrow">TRON TESTNET · EDUCATIONAL DAPP</p>
          <h1>MindPool Gold</h1>
          <p className="auth-copy">Clean single-screen color prediction experience. Connect your TRON testnet wallet to continue.</p>
          <button className="connect-main" onClick={handleConnect}>Connect TronLink Wallet</button>
          <button className="connect-demo" onClick={handleConnect}>Use Demo Wallet</button>
          <div className="auth-rules">
            <span>USDT → Gold Coins</span>
            <span>Lowest pool wins</span>
            <span>0 & 5 are Violet</span>
          </div>
          <footer>No real money · No seed phrase · Testnet only</footer>
        </section>
      </main>
    );
  }

  return (
    <main className="phone-stage">
      <section className="phone-screen">
        <header className="topbar clean">
          <div>
            <span>MindPool Gold</span>
            <strong>{view === 'game' ? 'Game' : view === 'ledger' ? 'Transactions' : 'Wallet'}</strong>
          </div>
          <div className="topbar-badges">
            <span className="badge testnet">TESTNET</span>
          </div>
        </header>

        <div className="screen-content">
          {view === 'game' && (
            <>
              <section className="balance-hero center">
                <span>Available Balance</span>
                <strong>{formatCoins(balance)}</strong>
                <small>{shortAddress(wallet.address)} · 1 USDT = 100 coins</small>
              </section>

              <section className="round-card clean-round">
                <div>
                  <p>Period</p>
                  <strong>{round.id}</strong>
                </div>
                <div className={`round-state ${round.status}`}>{round.status === 'betting' ? 'Bet Open' : 'Validating'}</div>
                <div className="timer">
                  <p>{round.status === 'betting' ? 'Bet closes' : 'Next round'}</p>
                  <strong>{formatTime(round.status === 'betting' ? round.bettingSecondsLeft : round.secondsLeft)}</strong>
                </div>
              </section>

              <section className="color-picks clean-cards">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={`color-pick ${color} ${selection.kind === 'color' && selection.color === color ? 'selected' : ''}`}
                    onClick={() => setSelection({ kind: 'color', color })}
                  >
                    <span>{color}</span>
                    <strong>{COLOR_MULTIPLIER[color]}x</strong>
                    {SPECIAL_COVER_NUMBER[color] !== undefined && <small>{SPECIAL_COVER_NUMBER[color]} = {SPECIAL_COVER_MULTIPLIER}x</small>}
                    {color === 'violet' && <small>0 / 5</small>}
                  </button>
                ))}
              </section>

              <section className="number-grid clean-grid">
                {Array.from({ length: 10 }).map((_, number) => {
                  const color = NUMBER_TO_COLOR[number];
                  return (
                    <button
                      key={number}
                      className={`number-chip ${color} ${selection.kind === 'number' && selection.number === number ? 'selected' : ''}`}
                      onClick={() => setSelection({ kind: 'number', number, color })}
                    >
                      <span>{number}</span>
                      <small>{NUMBER_MULTIPLIER}x</small>
                    </button>
                  );
                })}
              </section>

              <section className="bet-panel clean-panel">
                <div className="bet-stats">
                  <div><p>Pick</p><strong>{selectedLabel}</strong></div>
                  <div><p>Win</p><strong>{selectedMultiplier}x</strong>{specialCoverNumber !== undefined && <small className="cover-note">#{specialCoverNumber} = {SPECIAL_COVER_MULTIPLIER}x</small>}</div>
                  <div><p>Playable</p><strong>{formatCoins(feePreview.playableAmount)}</strong></div>
                </div>
                <div className="bet-entry">
                  <input type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} />
                  <button onClick={handlePlaceBet} disabled={round.status !== 'betting'}>Place Bet</button>
                </div>
                <div className="quick-row">
                  {QUICK_AMOUNTS.map((quick) => <button key={quick} onClick={() => setAmount(quick)}>{quick}</button>)}
                </div>
              </section>

              <section className="market-strip subtle-strip">
                {COLORS.map((color) => (
                  <div key={color} className={`market ${color}`}>
                    <span>{color}</span>
                    <strong>{round.status === 'betting' ? getActivityLabel(pools.colorPools[color], maxPool) : formatCoins(pools.colorPools[color])}</strong>
                  </div>
                ))}
              </section>

              {myPendingBet && <div className="active-bet">Current bet · <strong>{getSelectionLabel(myPendingBet)}</strong> · {formatCoins(myPendingBet.amount)}</div>}

              {lastResult && (
                <section className="result-strip compact-result">
                  <div><p>Last Round</p><strong>#{String(lastResult.roundId).slice(-6)}</strong></div>
                  <div><p>Winner</p><strong>{lastResult.winningColor?.toUpperCase() ?? '-'}</strong></div>
                  <div><p>Number</p><strong>{lastResult.winningNumber ?? '-'}</strong></div>
                </section>
              )}

              <section className="prediction-board">
                <div className="section-title"><strong>Prediction Board</strong><span>recent rounds</span></div>
                <div className="result-bubbles">
                  {recentResults.length === 0 && <p className="empty compact-empty">Results appear after the first round.</p>}
                  {recentResults.map((result) => (
                    <div className={`result-bubble ${result.winningColor ?? ''}`} key={result.roundId}>
                      <span>{result.winningNumber ?? '-'}</span>
                      <small>#{String(result.roundId).slice(-4)}</small>
                    </div>
                  ))}
                </div>

                <div className="mini-history">
                  <div className="section-title mini"><strong>My Last Bets</strong><span>win / loss</span></div>
                  {myRecentBets.length === 0 && <p className="empty compact-empty">Place a bet to see win/loss here.</p>}
                  {myRecentBets.map((bet) => (
                    <div className="mini-history-row" key={bet.id}>
                      <span>#{String(bet.roundId).slice(-5)}</span>
                      <strong>{getSelectionLabel(bet)}</strong>
                      <b className={bet.result ?? 'pending'}>{bet.result ?? 'pending'}</b>
                      <em>{bet.payout ? `+${formatCoins(bet.payout)}` : formatCoins(bet.amount)}</em>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {view === 'ledger' && (
            <section className="ledger-page">
              <section className="summary-row">
                <div className="summary-card">
                  <span>Topup</span>
                  <strong>{formatCoins(walletStats.totalTopup)}</strong>
                </div>
                <div className="summary-card">
                  <span>Winnings</span>
                  <strong>{formatCoins(walletStats.totalWins)}</strong>
                </div>
                <div className="summary-card">
                  <span>Withdraw</span>
                  <strong>{formatCoins(walletStats.totalWithdrawals)}</strong>
                </div>
              </section>
              <div className="section-title"><strong>Ledger</strong><span>transactions</span></div>
              <div className="ledger-tabs">
                {LEDGER_TABS.map((tab) => (
                  <button key={tab.id} className={ledgerTab === tab.id ? 'active' : ''} onClick={() => setLedgerTab(tab.id)}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="ledger-list">
                {filteredLedger.slice(0, 24).map((entry) => {
                  const signed = getSignedAmount(entry);
                  return (
                    <div className="ledger-row" key={entry.id}>
                      <div>
                        <strong>{entry.note}</strong>
                        <span>{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <b className={signed >= 0 ? 'credit' : 'debit'}>{signed >= 0 ? '+' : '-'}{formatCoins(Math.abs(signed))}</b>
                    </div>
                  );
                })}
                {filteredLedger.length === 0 && <p className="empty">No transactions yet.</p>}
              </div>
              <button className="reset-btn" onClick={resetDemo}>Reset demo data</button>
            </section>
          )}

          {view === 'wallet' && (
            <section className="wallet-page">
              <section className="profile-card">
                <div>
                  <p>Connected Wallet</p>
                  <strong>{shortAddress(wallet.address)}</strong>
                  <span>{wallet.network}</span>
                </div>
                <button className="logout-mini" onClick={handleDisconnect}>Disconnect</button>
              </section>

              <section className="balance-hero wallet-balance middle">
                <span>Gold Balance</span>
                <strong>{formatCoins(balance)}</strong>
                <small>{(balance / 100).toFixed(2)} test USDT value</small>
              </section>

              <section className="wallet-page-card">
                <div className="section-title"><strong>Buy Coins</strong><span>Topup</span></div>
                <div className="package-grid">
                  {BUY_PACKAGES.map((usdt) => (
                    <button key={usdt} onClick={() => handleBuyCoins(usdt)}>
                      <strong>{usdt} USDT</strong>
                      <span>{usdt * 100} coins</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="wallet-page-card">
                <div className="section-title"><strong>Sell / Withdraw</strong><span>Wallet actions</span></div>
                <div className="wallet-convert-card">
                  <label>Coins amount</label>
                  <input type="number" min="1" value={walletAmount} onChange={(event) => setWalletAmount(Number(event.target.value))} />
                  <small>{formatCoins(walletAmount)} coins ≈ {(walletAmount / 100).toFixed(2)} test USDT</small>
                  <div className="convert-actions">
                    <button onClick={handleSellCoins}>Sell Coins</button>
                    <button onClick={handleWithdrawCoins}>Withdraw</button>
                  </div>
                </div>
              </section>
            </section>
          )}

          <footer className="status-footer">{message}</footer>
        </div>

        <nav className="bottom-nav" aria-label="Main navigation">
          {BOTTOM_NAV.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? 'page' : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function getSignedAmount(entry: LedgerEntry) {
  return DEBIT_TYPES.includes(entry.type) ? -entry.amount : entry.amount;
}

function sumLedger(entries: LedgerEntry[], types: LedgerType[]) {
  return entries
    .filter((entry) => types.includes(entry.type))
    .reduce((sum, entry) => sum + entry.amount, 0);
}
