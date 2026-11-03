import { site } from '@/lib/site';

/** Le jalon posé sur un tracé : le logo, sans aucun symbole national. */
export function LogoMark({ className = 'size-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="var(--color-sapin-700)" />
      <path
        d="M6 27 C 14 27, 16 20, 22 20 S 30 13, 34 12"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="0.1 5.2"
      />
      <circle cx="22" cy="20" r="6" fill="var(--color-ocre-500)" stroke="#fff" strokeWidth="2.5" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className="block font-titre text-[1.375rem] font-semibold">{site.name}</span>
        <span className="mt-1 hidden text-xs text-encre-doux sm:block">{site.tagline}</span>
      </span>
    </span>
  );
}
