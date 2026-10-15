import clsx from 'clsx';

/** The mark: a rising market line ending in a brass point — the result. */
export function Mark({ size = 28, className, inverse }: { size?: number; className?: string; inverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="7" fill={inverse ? '#1f4677' : '#10294a'} />
      <path d="M7 22 L13 15 L18 19 L25 9" fill="none" stroke="#6fa3db" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="25" cy="9" r="2.6" fill="#b8862b" />
    </svg>
  );
}

export function Wordmark({ inverse, className }: { inverse?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <Mark size={26} inverse={inverse} />
      <span className={clsx('t-display text-[17px] leading-none', inverse ? 'text-white' : 'text-ink')}>
        Blue Market<span className={clsx('ml-1.5 font-[480]', inverse ? 'text-sky' : 'text-market')}>Ads</span>
      </span>
    </span>
  );
}
