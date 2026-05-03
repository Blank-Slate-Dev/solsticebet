// apps/demo-web/src/components/casino/ActionButton.tsx
//
// Casino-style action button: pill-shaped, icon + label, multiple visual variants.

import type { ReactNode } from 'react';

interface ActionButtonProps {
  readonly icon?: ReactNode;
  readonly label: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
}

export function ActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  variant = 'secondary',
}: ActionButtonProps) {
  const variantClass =
    variant === 'primary'
      ? 'bg-gradient-to-r from-solstice-accent to-solstice-accent-deep text-solstice-bg hover:opacity-90'
      : variant === 'success'
        ? 'bg-solstice-win text-solstice-bg hover:opacity-90'
        : variant === 'danger'
          ? 'border border-solstice-loss/40 bg-solstice-loss/10 text-solstice-loss hover:bg-solstice-loss/20'
          : variant === 'warning'
            ? 'border border-yellow-500/40 bg-yellow-500/10 text-yellow-200 hover:bg-yellow-500/20'
            : 'border border-solstice-border bg-solstice-card/60 text-solstice-fg hover:border-solstice-accent';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || onClick === undefined}
      className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition disabled:opacity-30 disabled:hover:border-solstice-border ${variantClass}`}
    >
      {icon !== undefined && <span className="text-base">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
