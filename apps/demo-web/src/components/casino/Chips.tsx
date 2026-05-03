// apps/demo-web/src/components/casino/Chips.tsx
//
// Casino chip primitives: clickable chip denominations, chip stacks, bet circles.

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

const CHIP_BG: Readonly<Record<ChipDenom['color'], string>> = {
  white: 'bg-zinc-100 text-zinc-900 border-zinc-300',
  red: 'bg-red-600 text-white border-red-400',
  blue: 'bg-blue-600 text-white border-blue-400',
  green: 'bg-green-600 text-white border-green-400',
  black: 'bg-zinc-900 text-white border-zinc-600',
  purple: 'bg-purple-600 text-white border-purple-400',
};

interface ChipProps {
  readonly denom: ChipDenom;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly size?: 'sm' | 'md' | 'lg';
}

/**
 * A single clickable chip. Style mimics a real casino chip with two layers
 * (outer ring + inner face) and a dashed border pattern.
 */
export function Chip({ denom, onClick, disabled = false, size = 'md' }: ChipProps) {
  const sizeClasses =
    size === 'sm'
      ? 'h-10 w-10 text-xs'
      : size === 'lg'
        ? 'h-14 w-14 text-base'
        : 'h-12 w-12 text-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || onClick === undefined}
      className={`relative ${sizeClasses} rounded-full border-2 border-dashed font-bold shadow-md transition hover:scale-110 hover:shadow-xl active:scale-95 disabled:opacity-50 disabled:hover:scale-100 ${CHIP_BG[denom.color]}`}
      aria-label={`Chip ${denom.label}`}
    >
      <span className="relative">{denom.label}</span>
    </button>
  );
}

interface ChipSelectorProps {
  readonly disabled?: boolean;
  readonly onPick: (denom: ChipDenom) => void;
  readonly denoms?: readonly ChipDenom[];
}

/**
 * Horizontal row of clickable chip denominations.
 * Player clicks a chip to add that amount to their bet.
 */
export function ChipSelector({
  disabled = false,
  onPick,
  denoms = CHIP_DENOMS,
}: ChipSelectorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {denoms.map((denom) => (
        <Chip
          key={denom.label}
          denom={denom}
          disabled={disabled}
          onClick={() => {
            onPick(denom);
          }}
        />
      ))}
    </div>
  );
}

interface BetCircleProps {
  readonly label: string;
  readonly amount: bigint;
  readonly highlight?: boolean;
  readonly disabled?: boolean;
  readonly tooltip?: string;
  readonly onClick?: () => void;
  readonly size?: 'sm' | 'md';
}

/**
 * A circular bet spot where chips are stacked. Shows the current bet amount.
 */
export function BetCircle({
  label,
  amount,
  highlight = false,
  disabled = false,
  tooltip,
  onClick,
  size = 'md',
}: BetCircleProps) {
  const dim = size === 'sm' ? 'h-16 w-16' : 'h-20 w-20';
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`text-[10px] uppercase tracking-widest text-solstice-muted`}>{label}</div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || onClick === undefined}
        title={tooltip}
        className={`${dim} relative flex items-center justify-center rounded-full border-2 border-dashed transition ${
          highlight
            ? 'border-solstice-accent bg-solstice-accent/10'
            : disabled
              ? 'border-solstice-border/40 bg-solstice-card/20 text-solstice-muted'
              : 'border-solstice-border bg-solstice-card/40 hover:border-solstice-accent'
        } ${onClick !== undefined && !disabled ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {amount > 0n ? (
          <div className={`${textSize} font-mono font-bold text-solstice-fg chip-place`}>
            {formatAmountDisplay(amount)}
          </div>
        ) : (
          <div className={`${textSize} text-solstice-muted/60`}>{disabled ? 'soon' : '+'}</div>
        )}
      </button>
    </div>
  );
}
