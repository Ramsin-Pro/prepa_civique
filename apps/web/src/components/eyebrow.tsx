import type { ReactNode } from 'react';

/** Petit sur-titre en capitales au-dessus d'un titre. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-encre-doux">{children}</p>;
}
