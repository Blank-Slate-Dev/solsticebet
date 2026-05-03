// apps/demo-web/src/components/CoinFlipGame.tsx

'use client';

import { useState } from 'react';

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';
import {
  placeCoinFlipBet,
  type CoinFlipBetOutcome,
  type CoinSide,
} from '@solsticebet/game-coin-flip';

import { useSession } from '@/lib/session-context';

const SPIN_DURATION_MS = 1100;

export function CoinFlipGame() {
  const { session, refresh, bumpNonce, bumpBetCount } = useSession();
  const [stake, setStake] = useState('1');
  const [pick, setPick] = useState<CoinSide>('heads');
  const [busy, setBusy] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<CoinFlipBetOutcome | null>(null);

  const flip = async () => {
    if (session === null) return;
    setError(null);
    setBusy(true);
    try {
      const num = bumpBetCount();
      const out = await placeCoinFlipBet(session.ledger, {
        betId: `coin-${String(num)}`,
        userAccountId: session.user,
        escrowAccountId: session.escrow,
        houseAccountId: session.house,
        stake: parseAmount(stake),
        pick,
        currency: 'INTERNAL_USDT',
        serverSeed: session.serverSeed,
        clientSeed: session.clientSeed,
        nonce: session.coinFlipNonce,
      });
      bumpNonce('coin-flip');

      // Start animation; only show result after the coin lands.
      setSpinning(true);
      setLast(null);
      setSpinKey((k) => k + 1);
      await new Promise((r) => setTimeout(r, SPIN_DURATION_MS));
      setSpinning(false);
      setLast(out);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // The coin renders heads or tails depending on `last` (or the user's pick during idle/spin)
  const showSide = spinning ? pick : (last?.result ?? pick);
  const settled = !spinning && last !== null;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
      <div className="flex flex-col items-center justify-center rounded-lg border border-solstice-border bg-solstice-bg/40 p-8 min-h-[320px]">
        <div className="text-[10px] uppercase tracking-widest text-solstice-muted">
          {spinning ? 'Flipping...' : last !== null ? 'Result' : 'Pick & flip'}
        </div>
        <div className="mt-4 perspective-[800px]">
          <div
            key={spinKey}
            className={`flex h-32 w-32 items-center justify-center rounded-full border-4 text-5xl font-bold shadow-lg ${
              showSide === 'heads'
                ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300'
                : 'border-zinc-400 bg-zinc-500/20 text-zinc-300'
            } ${spinning ? 'coin-flip' : ''} ${settled && last?.isWin === true ? 'win-flash' : ''}`}
          >
            {showSide === 'heads' ? 'H' : 'T'}
          </div>
        </div>
        {settled && last !== null ? (
          <div className="mt-4 text-center">
            <div className="text-sm uppercase tracking-widest text-solstice-muted">
              {last.result}
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold ${
                last.isWin ? 'text-solstice-win' : 'text-solstice-loss'
              }`}
            >
              {last.isWin
                ? `+${formatAmountDisplay(last.payout - last.stake)} USDT`
                : `−${formatAmountDisplay(last.stake)} USDT`}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wider text-solstice-muted">
            Stake (USDT)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={(e) => {
              setStake(e.target.value);
            }}
            disabled={busy}
            className="w-full rounded-md border border-solstice-border bg-solstice-bg px-3 py-2 font-mono text-sm text-solstice-fg focus:border-solstice-accent focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-solstice-muted">
            Your pick
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPick('heads');
              }}
              disabled={busy}
              className={`rounded-md border px-3 py-3 text-sm font-medium transition ${
                pick === 'heads'
                  ? 'border-yellow-400 bg-yellow-500/20 text-yellow-300'
                  : 'border-solstice-border bg-solstice-card text-solstice-muted hover:text-solstice-fg'
              }`}
            >
              Heads
            </button>
            <button
              type="button"
              onClick={() => {
                setPick('tails');
              }}
              disabled={busy}
              className={`rounded-md border px-3 py-3 text-sm font-medium transition ${
                pick === 'tails'
                  ? 'border-zinc-400 bg-zinc-500/20 text-zinc-300'
                  : 'border-solstice-border bg-solstice-card text-solstice-muted hover:text-solstice-fg'
              }`}
            >
              Tails
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void flip();
          }}
          disabled={busy || session === null}
          className="w-full rounded-md bg-gradient-to-r from-solstice-accent to-solstice-accent-deep px-4 py-3 text-sm font-bold text-solstice-bg hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Flipping...' : `Flip (${stake} USDT)`}
        </button>
        {error !== null && <p className="text-xs text-solstice-loss">{error}</p>}
        <div className="rounded-md border border-solstice-border bg-solstice-bg/50 p-3 text-[11px] text-solstice-muted">
          Pays 1.96× on win (2% house edge).
        </div>
      </div>
    </div>
  );
}
