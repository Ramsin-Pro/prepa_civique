/** Barre de maîtrise d'un thème : acquis (plein), vus mais pas encore acquis (clair), jamais vus (vide). */
export function MasteryBar({ total, seen, mastered, label }: { total: number; seen: number; mastered: number; label: string }) {
  const percent = (value: number) => (total > 0 ? `${(value / total) * 100}%` : '0%');
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={mastered}
      aria-valuetext={`${mastered} acquises sur ${total}`}
      className="relative h-2 overflow-hidden rounded-full bg-ligne"
    >
      <span className="absolute inset-y-0 left-0 rounded-full bg-sapin-100" style={{ width: percent(seen) }} />
      <span className="absolute inset-y-0 left-0 rounded-full bg-sapin-500" style={{ width: percent(mastered) }} />
    </div>
  );
}
