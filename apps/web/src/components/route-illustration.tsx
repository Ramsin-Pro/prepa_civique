/** Le motif signature : un tracé qui relie les trois parcours comme des étapes d'un itinéraire. */
export function RouteIllustration() {
  const route = 'M40 320 C 140 320, 130 210, 225 205 S 330 95, 420 70';
  return (
    <div
      role="img"
      aria-label="Un tracé relie trois étapes : carte de séjour pluriannuelle, carte de résident, naturalisation"
      className="rounded-[22px] border border-ligne bg-white p-2 shadow-carte"
    >
      <svg viewBox="0 0 460 380" className="block h-auto w-full" aria-hidden="true">
        <defs>
          <pattern id="grille-points" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--color-ligne)" />
          </pattern>
        </defs>
        <rect width="460" height="380" rx="16" fill="var(--color-papier)" />
        <rect width="460" height="380" rx="16" fill="url(#grille-points)" />
        <path d={route} fill="none" stroke="var(--color-sapin-100)" strokeWidth="14" strokeLinecap="round" />
        <path d={route} fill="none" stroke="var(--color-sapin-500)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" />

        <g fontFamily="var(--font-atkinson), sans-serif" fontSize="14" fontWeight="700" fill="var(--color-encre)">
          <circle cx="62" cy="319" r="15" fill="var(--color-sapin-700)" stroke="#fff" strokeWidth="4" />
          <text x="40" y="355">Carte de séjour</text>
          <text x="40" y="372">pluriannuelle</text>
          <circle cx="225" cy="205" r="15" fill="var(--color-ocre-500)" stroke="#fff" strokeWidth="4" />
          <text x="248" y="238">Carte de résident</text>
          <circle cx="404" cy="74" r="15" fill="var(--color-prune-700)" stroke="#fff" strokeWidth="4" />
          <text x="292" y="120">Naturalisation</text>
        </g>

        <g transform="translate(36 40)">
          <rect width="200" height="96" rx="12" fill="#fff" stroke="var(--color-ligne)" />
          <text x="16" y="28" fontFamily="var(--font-atkinson), sans-serif" fontSize="12" fill="var(--color-encre-doux)">
            Question 12 sur 40
          </text>
          <text x="16" y="54" fontFamily="var(--font-fraunces), serif" fontSize="20" fontWeight="600" fill="var(--color-encre)">
            Bonne réponse
          </text>
          <circle cx="176" cy="48" r="11" fill="var(--color-sapin-500)" />
          <path d="M170 48l4 4 8-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="16" y="70" width="168" height="6" rx="3" fill="var(--color-ligne)" />
          <rect x="16" y="70" width="50" height="6" rx="3" fill="var(--color-sapin-500)" />
        </g>
      </svg>
    </div>
  );
}
