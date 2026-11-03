import Link from 'next/link';
import type { ReactNode } from 'react';

/** Fil d'Ariane et titre des pages d'entraînement. */
export function TrainingHeader({ pathTitle, title, children }: { pathTitle: string; title: string; children?: ReactNode }) {
  return (
    <>
      <nav aria-label="Fil d’Ariane" className="text-petit text-encre-doux">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/entrainement" className="underline underline-offset-4 hover:text-sapin-700">
              Entraînement
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>{pathTitle}</li>
        </ol>
      </nav>
      <h1 className="mt-3 text-[1.75rem] leading-tight sm:text-[2.25rem]">{title}</h1>
      {children && <div className="mt-2 max-w-2xl text-encre-doux">{children}</div>}
    </>
  );
}
