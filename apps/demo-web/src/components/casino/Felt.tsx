// apps/demo-web/src/components/casino/Felt.tsx

import type { ReactNode } from 'react';

interface FeltProps {
  /** Optional tagline shown faintly in the center (e.g. "BLACKJACK PAYS 3 TO 2"). */
  readonly tagline?: string;
  /** Optional secondary tagline below the first. */
  readonly subTagline?: string;
  readonly children: ReactNode;
}

/**
 * Oval felt-style casino table. Renders a stadium-shaped backdrop with a
 * subtle border, optional centered tagline text, and the children laid
 * out on top of it.
 */
export function Felt({ tagline, subTagline, children }: FeltProps) {
  return (
    <div className="relative w-full">
      {/* Felt oval */}
      <div
        className="relative mx-auto h-[420px] w-full max-w-3xl overflow-visible rounded-[210px] border border-solstice-border bg-gradient-to-b from-[#0d1428] via-[#0a1024] to-[#0a1024] shadow-2xl"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(56, 214, 227, 0.04) 0%, transparent 60%)',
        }}
      >
        {/* Faint inner ring */}
        <div className="absolute inset-3 rounded-[200px] border border-solstice-border/40" />

        {/* Center taglines */}
        {(tagline !== undefined || subTagline !== undefined) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {tagline !== undefined && (
              <div className="rounded-md bg-solstice-accent-deep/40 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-solstice-fg/40">
                {tagline}
              </div>
            )}
            {subTagline !== undefined && (
              <div className="mt-1 rounded-md bg-solstice-accent-deep/40 px-4 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-solstice-fg/40">
                {subTagline}
              </div>
            )}
          </div>
        )}

        {/* Children layered on top */}
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
