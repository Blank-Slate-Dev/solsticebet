// apps/demo-web/src/components/cards/PlayingCard.tsx
//
// Reusable playing card with optional flip-in animation.
// Used by Baccarat, Blackjack, UTH, Hi-Lo.

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
const SUIT_GLYPHS = ['♠', '♥', '♦', '♣'] as const;

export function rankLabel(rank: number): string {
  return RANK_LABELS[rank] ?? '?';
}

export function suitGlyph(suit: number): string {
  return SUIT_GLYPHS[suit] ?? '?';
}

export function isRedSuit(suit: number): boolean {
  return suit === 1 || suit === 2; // hearts, diamonds
}

interface PlayingCardProps {
  /** Rank 0..12. */
  readonly rank: number | null;
  /** Suit 0..3, or undefined for suitless cards (Baccarat/Blackjack/Hi-Lo). */
  readonly suit?: number;
  readonly faceDown?: boolean;
  readonly highlight?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
  /** Animation key — when this changes, the card replays its flip-in animation. */
  readonly animationKey?: string | number;
  /** Disables the flip animation (e.g. for cards already shown). */
  readonly noAnimate?: boolean;
}

/**
 * A playing card with optional flip-in animation.
 *
 * Pass an `animationKey` that increments when the card changes; the card will
 * play a flip-in transition. Omit or set `noAnimate` to skip animation.
 */
export function PlayingCard({
  rank,
  suit,
  faceDown = false,
  highlight = false,
  size = 'md',
  animationKey,
  noAnimate = false,
}: PlayingCardProps) {
  const sizeClasses = size === 'lg' ? 'h-24 w-16' : size === 'sm' ? 'h-12 w-9' : 'h-20 w-14';
  const rankSize = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-xs' : 'text-sm';
  const suitSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-2xl';
  const animClass = noAnimate ? '' : 'card-flip-in';

  if (faceDown || rank === null) {
    return (
      <div
        key={animationKey}
        className={`flex ${sizeClasses} items-center justify-center rounded-md border border-solstice-border bg-gradient-to-br from-solstice-accent-deep to-solstice-bg shadow-md ${animClass}`}
      >
        <div className="h-2/3 w-2/3 rounded border border-solstice-accent/40 bg-solstice-accent/10" />
      </div>
    );
  }

  const red = suit !== undefined && isRedSuit(suit);
  return (
    <div
      key={animationKey}
      className={`flex ${sizeClasses} flex-col items-center ${
        size === 'sm' ? 'justify-center' : 'justify-between'
      } rounded-md border bg-white p-1 text-black shadow-md transition ${
        highlight ? 'border-solstice-accent ring-2 ring-solstice-accent/50' : 'border-zinc-300'
      } ${animClass}`}
    >
      <div className={`${rankSize} font-bold ${red ? 'text-red-600' : 'text-zinc-900'}`}>
        {rankLabel(rank)}
      </div>
      {size !== 'sm' && (
        <>
          <div className={`${suitSize} ${red ? 'text-red-600' : 'text-zinc-900'}`}>
            {suit !== undefined ? suitGlyph(suit) : ''}
          </div>
          <div
            className={`rotate-180 ${rankSize} font-bold ${red ? 'text-red-600' : 'text-zinc-900'}`}
          >
            {rankLabel(rank)}
          </div>
        </>
      )}
    </div>
  );
}
