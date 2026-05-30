import type { ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  variant?: 'primary' | 'quiet';
};

export function IconButton({ icon: Icon, label, variant = 'quiet', className = '', ...props }: IconButtonProps) {
  const styles =
    variant === 'primary'
      ? 'border-buy/50 bg-buy/15 text-buy hover:bg-buy/20'
      : 'border-line bg-panelSoft text-muted hover:text-ink';

  return (
    <button
      className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${styles} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      title={label}
      type="button"
      {...props}
    >
      <Icon size={16} />
      <span>{label}</span>
    </button>
  );
}