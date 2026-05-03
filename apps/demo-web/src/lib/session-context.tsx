// apps/demo-web/src/lib/session-context.tsx

'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { type LedgerEntry } from '@solsticebet/ledger';

import { bootstrapSession, type DemoSession } from './session';

interface SessionState {
  session: DemoSession | null;
  balanceWei: bigint;
  recentEntries: readonly LedgerEntry[];
  /** Refresh balance + recent entries from the ledger. */
  refresh: () => Promise<void>;
  /** Increment a nonce (after placing a bet of that game type). */
  bumpNonce: (game: 'dice' | 'mines' | 'plinko' | 'roulette' | 'baccarat' | 'blackjack') => void;
  /** Increment the bet counter (used to mint unique bet IDs). */
  bumpBetCount: () => number;
  /** Reset the session to a fresh state. */
  reset: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

const RECENT_ENTRY_LIMIT = 25;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [balanceWei, setBalanceWei] = useState<bigint>(0n);
  const [recentEntries, setRecentEntries] = useState<readonly LedgerEntry[]>([]);

  const refresh = useCallback(async () => {
    if (session === null) return;
    const bal = await session.ledger.getBalance(session.user, 'INTERNAL_USDT');
    setBalanceWei(bal);
    const entries = await session.ledger.getEntries(session.user, {
      limit: RECENT_ENTRY_LIMIT,
    });
    setRecentEntries(entries);
  }, [session]);

  const reset = useCallback(async () => {
    const fresh = await bootstrapSession();
    setSession(fresh);
    const bal = await fresh.ledger.getBalance(fresh.user, 'INTERNAL_USDT');
    setBalanceWei(bal);
    setRecentEntries([]);
  }, []);

  useEffect(() => {
    void reset();
  }, [reset]);

  const bumpNonce = useCallback(
    (game: 'dice' | 'mines' | 'plinko' | 'roulette' | 'baccarat' | 'blackjack') => {
      if (session === null) return;
      if (game === 'dice') session.diceNonce += 1;
      else if (game === 'mines') session.minesNonce += 1;
      else if (game === 'plinko') session.plinkoNonce += 1;
      else if (game === 'roulette') session.rouletteNonce += 1;
      else if (game === 'baccarat') session.baccaratNonce += 1;
      else session.blackjackNonce += 1;
    },
    [session],
  );

  const bumpBetCount = useCallback((): number => {
    if (session === null) return 0;
    session.betCount += 1;
    return session.betCount;
  }, [session]);

  const value: SessionState = {
    session,
    balanceWei,
    recentEntries,
    refresh,
    bumpNonce,
    bumpBetCount,
    reset,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (ctx === null) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return ctx;
}
