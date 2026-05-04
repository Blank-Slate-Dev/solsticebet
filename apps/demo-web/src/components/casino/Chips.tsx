// apps/demo-web/src/components/casino/Chips.tsx
//
// Rainbet-style casino chips: 8 white edge dashes, dashed inner ring,
// solid color centre, white value text, soft shadow.

import { formatAmountDisplay, parseAmount } from '@solsticebet/ledger';

/**
 * Standard chip denominations in INTERNAL_USDT units.
 * Player clicks a chip to add that amount to their bet.
 */
export interface ChipDenom {
  readonly value: bigint;
  readonly color: 'white' | 'red' | 'blue' | 'green' | 'black' | 'purple';
  readonly label: string;
}

export const CHIP_DENOMS: readonly ChipDenom[] = [
  { value: parseAmount('1'), color: 'white', label: '1' },
  { value: parseAmount('5'), color: 'red', label: '5' },
  { value: parseAmount('10'), color: 'blue', label: '10' },
  { value: parseAmount('25'), color: 'green', label: '25' },
  { value: parseAmount('100'), color: 'black', label: '100' },
  { value: parseAmount('500'), color: 'purple', label: '500' },
];

/**
 * Color recipes for each chip. `face` is the inner disc, `ring` is the
 * outer ring (slightly darker), `text` is the centre text color, and
 * `shadow` is the colored ambient shadow projected onto the felt.
 */
const CHIP_COLORS: Readonly<
  Record<ChipDenom['color'], { face: string; ring: string; text: string; shadow: string }>
> = {
  white: {
    face: '#e5e7eb', // zinc-200
    ring: '#9ca3af', // zinc-400
    text: '#1f2937', // zinc-800 (only chip with dark text)
    shadow: 'rgba(229, 231, 235, 0.4)',
  },
  red: {
    face: '#dc2626',
    ring: '#991b1b',
    text: '#ffffff',
    shadow: 'rgba(220, 38, 38, 0.5)',
  },
  blue: {
    face: '#2563eb',
    ring: '#1e40af',
    text: '#ffffff',
    shadow: 'rgba(37, 99, 235, 0.5)',
  },
  green: {
    face: '#10b981',
    ring: '#065f46',
    text: '#ffffff',
    shadow: 'rgba(16, 185, 129, 0.5)',
  },
  black: {
    face: '#1f2937', // zinc-800
    ring: '#0f172a', // slate-900
    text: '#ffffff',
    shadow: 'rgba(31, 41, 55, 0.5)',
  },
  purple: {
    face: '#9333ea',
    ring: '#6b21a8',
    text: '#ffffff',
    shadow: 'rgba(147, 51, 234, 0.5)',
  },
};

interface ChipProps {
  readonly denom: ChipDenom;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}

/**
 * A single Rainbet-style casino chip.
 *
 * The visual is built in layers:
 *   1. Outer disc (the "ring") — slightly darker shade
 *   2. 8 white pill-shaped edge dashes positioned around the rim
 *   3. Inner disc (the "face") — same color as ring
 *   4. Dashed white inner ring
 *   5. Centre value text
 *
 * All achievable in pure CSS / inline styles, no SVG required.
 */
export function Chip({ denom, onClick, disabled = false, size = 'md' }: ChipProps) {
  const dim = size === 'sm' ? 40 : size === 'lg' ? 64 : 56; // diameter in px
  const fontSize = size === 'sm' ? '11px' : size === 'lg' ? '17px' : '15px';
  const colors = CHIP_COLORS[denom.color];

  // 8 dashes evenly spaced around the rim. We position each absolutely
  // using rotation around the chip's center.
  const dashCount = 8;
  const dashLength = size === 'sm' ? 8 : size === 'lg' ? 13 : 11;
  const dashWidth = size === 'sm' ? 5 : size === 'lg' ? 8 : 7;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || onClick === undefined}
      aria-label={`Chip ${denom.label}`}
      style={{
        width: `${String(dim)}px`,
        height: `${String(dim)}px`,
        background: colors.ring,
        boxShadow: `0 4px 8px rgba(0, 0, 0, 0.4), 0 0 12px ${colors.shadow}`,
      }}
      className="relative shrink-0 rounded-full transition hover:-translate-y-1 hover:shadow-2xl active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0"
    >
      {/* Outer rim with 8 white dashes positioned around it */}
      {Array.from({ length: dashCount }).map((_, i) => {
        const angle = (i * 360) / dashCount;
        return (
          <span
            key={i}
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${String(dashWidth)}px`,
              height: `${String(dashLength)}px`,
              background: '#ffffff',
              borderRadius: '2px',
              // Rotate dash to its angular position around the chip,
              // then translate outward to the rim.
              transform: `translate(-50%, -50%) rotate(${String(angle)}deg) translateY(-${String(dim / 2 - dashLength / 2 - 1)}px)`,
              transformOrigin: 'center center',
            }}
          />
        );
      })}

      {/* Inner face (smaller circle) — sits above the dashes so they only
          peek out at the rim */}
      <span
        style={{
          position: 'absolute',
          top: '15%',
          left: '15%',
          width: '70%',
          height: '70%',
          background: colors.face,
          borderRadius: '50%',
          // Dashed inner ring border
          border: `1.5px dashed rgba(255, 255, 255, ${denom.color === 'white' ? '0.6' : '0.7'})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.text,
          fontWeight: 700,
          fontSize,
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        {denom.label}
      </span>
    </button>
  );
}

interface ChipSelectorProps {
  readonly disabled?: boolean;
  readonly onPick: (denom: ChipDenom) => void;
  readonly denoms?: readonly ChipDenom[];
  readonly size?: 'sm' | 'md' | 'lg';
}

/**
 * Horizontal row of clickable chip denominations.
 */
export function ChipSelector({
  disabled = false,
  onPick,
  denoms = CHIP_DENOMS,
  size = 'md',
}: ChipSelectorProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {denoms.map((denom) => (
        <Chip
          key={denom.label}
          denom={denom}
          disabled={disabled}
          size={size}
          onClick={() => {
            onPick(denom);
          }}
        />
      ))}
    </div>
  );
}

/**
 * Decomposes a bet amount into the largest-denomination chip stack that sums
 * to exactly that amount. Greedy: takes the largest chip that fits, repeats.
 *
 * Returns chips ordered largest → smallest (the order they'd be played onto
 * the table — bigger chips at the bottom, smaller ones on top).
 */
export function decomposeIntoChips(amount: bigint): readonly ChipDenom[] {
  const chips: ChipDenom[] = [];
  let remaining = amount;
  // Iterate denominations largest-first.
  const sorted = [...CHIP_DENOMS].sort((a, b) => Number(b.value - a.value));
  for (const denom of sorted) {
    while (remaining >= denom.value) {
      chips.push(denom);
      remaining -= denom.value;
    }
  }
  return chips;
}

interface ChipStackProps {
  readonly chips: readonly ChipDenom[];
  readonly size?: 'sm' | 'md' | 'lg';
}

/**
 * Renders a stack of chips with each chip slightly above the previous, giving
 * a visual sense of stacked physical chips on the table. Bottom chip is the
 * largest denomination, top chip is the smallest.
 */
export function ChipStack({ chips, size = 'sm' }: ChipStackProps) {
  // Cap visible stack at 8 chips. If there are more, show "+N" indicator.
  const VISIBLE = 8;
  const visible = chips.slice(0, VISIBLE);
  const hidden = chips.length - visible.length;
  // We render in reverse order so the bottom chip in the stack is the
  // largest and the top chip is the smallest. Each subsequent chip is
  // shifted upward by ~5px.
  const offsetPerChip = 5;
  return (
    <div
      className="relative"
      style={{
        width: size === 'sm' ? '40px' : '56px',
        height: `${String(visible.length * offsetPerChip + 40)}px`,
      }}
    >
      {visible
        .slice()
        .reverse() // largest at bottom
        .map((denom, i) => (
          <div
            key={i}
            className="absolute left-0"
            style={{
              bottom: `${String(i * offsetPerChip)}px`,
              zIndex: i,
            }}
          >
            <Chip denom={denom} size={size} />
          </div>
        ))}
      {hidden > 0 && (
        <div
          className="absolute left-0 right-0 -top-3 text-center text-[10px] font-bold text-solstice-fg"
          style={{ zIndex: VISIBLE + 1 }}
        >
          +{String(hidden)}
        </div>
      )}
    </div>
  );
}

interface BetCircleProps {
  readonly label: string;
  readonly amount: bigint;
  readonly highlight?: boolean;
  readonly disabled?: boolean;
  readonly tooltip?: string;
  /** Triggered when the empty bet circle (or label) is clicked. */
  readonly onClick?: () => void;
  /** Triggered when the chip stack itself is clicked — should remove the top chip. */
  readonly onRemoveChip?: () => void;
  readonly size?: 'sm' | 'md';
}

/**
 * A circular bet spot showing a visual chip stack of the placed bet.
 *
 * Behavior:
 *   - Click empty circle (no chips placed yet): triggers `onClick` (e.g. to
 *     make this circle the active one for incoming chips)
 *   - Click stacked chips: triggers `onRemoveChip` to remove the top (smallest)
 *     chip from the bet
 *   - Total amount displayed below the chip stack
 */
export function BetCircle({
  label,
  amount,
  highlight = false,
  disabled = false,
  tooltip,
  onClick,
  onRemoveChip,
  size = 'md',
}: BetCircleProps) {
  const dim = size === 'sm' ? 'h-16 w-16' : 'h-20 w-20';
  const chips = decomposeIntoChips(amount);
  const hasChips = chips.length > 0;
  const chipSize = size === 'sm' ? 'sm' : 'sm'; // always sm chips inside a circle
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-[10px] uppercase tracking-widest text-solstice-muted">{label}</div>
      <button
        type="button"
        onClick={hasChips ? onRemoveChip : onClick}
        disabled={disabled || (hasChips ? onRemoveChip === undefined : onClick === undefined)}
        title={hasChips ? 'Click to remove top chip' : tooltip}
        className={`${dim} relative flex items-center justify-center rounded-full border-2 border-dashed transition ${
          highlight
            ? 'border-solstice-accent bg-solstice-accent/10'
            : disabled
              ? 'border-solstice-border/40 bg-solstice-card/20 text-solstice-muted'
              : 'border-solstice-border bg-solstice-card/40 hover:border-solstice-accent'
        } ${(hasChips ? onRemoveChip !== undefined : onClick !== undefined) && !disabled ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {hasChips ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ChipStack chips={chips} size={chipSize} />
          </div>
        ) : (
          <div className="text-[10px] text-solstice-muted/60">{disabled ? 'soon' : '+'}</div>
        )}
      </button>
      {hasChips && (
        <div className="font-mono text-[11px] font-bold text-solstice-fg">
          {formatAmountDisplay(amount)}
        </div>
      )}
    </div>
  );
}
