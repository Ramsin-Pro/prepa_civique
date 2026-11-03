type IconProps = { className?: string };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function CheckIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={3} className={className} {...stroke}>
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2.5} className={className} {...stroke}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function InfoIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} className={className} {...stroke}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 11v6M12 7.5v.5" strokeWidth={2.4} />
    </svg>
  );
}

export function SourceIcon({ className = 'size-3.5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2.4} className={className} {...stroke}>
      <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" />
      <path d="M8.5 12l2.5 2.5 4.5-5" />
    </svg>
  );
}

export function ClockIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2.4} className={className} {...stroke}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2M9 2h6" />
    </svg>
  );
}

/** Groupe de personnes : offre des associations et structures. */
export function GroupIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} className={className} {...stroke}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 13.9c1.8.9 3 2.8 3 5.1" />
    </svg>
  );
}

/** Pastille pleine : bonne réponse. */
export function CorrectBadge({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-sapin-500)" />
      <path d="M7 12.5l3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Pastille pleine : réponse à revoir. Un point plutôt qu'une croix, pour rester encourageant. */
export function RetryBadge({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="var(--color-brique-700)" />
      <path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}
