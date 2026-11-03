import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClasses } from '@/components/button';

export const metadata: Metadata = { title: 'Page introuvable', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="text-[2.125rem] leading-tight">Cette page n’existe pas</h1>
      <p className="mt-3 text-encre-doux">L’adresse est peut-être incomplète, ou la page a été déplacée.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClasses('primary')}>
          Retour à l’accueil
        </Link>
        <Link href="/entrainement" className={buttonClasses('secondary')}>
          S’entraîner
        </Link>
      </div>
    </div>
  );
}
