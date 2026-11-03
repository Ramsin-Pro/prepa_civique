'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Me } from '@/lib/types';

type NavItem = { href: string; label: string };

let account: Promise<Me | null> | null = null;

/** Compte connecté, demandé une seule fois par page (l'en-tête reste statique côté serveur). */
function useAccount(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  useEffect(() => {
    account ??= fetch('/api/auth/me')
      .then((res) => (res.ok ? (res.json() as Promise<{ user: Me | null }>) : { user: null }))
      .then((body) => body.user)
      .catch(() => null);
    let cancelled = false;
    void account.then((user) => !cancelled && setMe(user));
    return () => {
      cancelled = true;
    };
  }, []);
  return me;
}

/** Rubrique du menu principal : celle où l'on se trouve est signalée, à l'œil et aux lecteurs d'écran (aria-current). */
export function NavLink({ href, label }: NavItem) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className="hidden decoration-ocre-500 decoration-[3px] underline-offset-[10px] hover:text-sapin-700 hover:underline aria-[current=page]:text-sapin-700 aria-[current=page]:underline lg:inline"
    >
      {label}
    </Link>
  );
}

/** Lien de compte de l'en-tête : « Se connecter » ou « Mon espace ». Réserve sa place pendant le chargement. */
export function AccountLink() {
  const me = useAccount();
  if (me === undefined) return <span className="hidden w-24 lg:inline-block" aria-hidden="true" />;
  return (
    <Link href={me ? '/espace' : '/connexion'} className="hidden font-bold hover:text-sapin-700 hover:underline lg:inline">
      {me ? 'Mon espace' : 'Se connecter'}
    </Link>
  );
}

/** Menu des petits écrans : toutes les rubriques et le compte, au doigt. */
export function MobileMenu({ links }: { links: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const me = useAccount();
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  // Une navigation referme le menu.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Toucher l'écran hors du menu le referme aussi.
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  const accountLinks: NavItem[] = me
    ? [{ href: '/espace', label: 'Mon espace' }, ...(me.staff ? [{ href: '/admin', label: 'Back-office' }] : [])]
    : [
        { href: '/connexion', label: 'Se connecter' },
        { href: '/inscription', label: 'Créer un compte' },
      ];

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="menu-mobile"
        className="inline-flex min-h-11 items-center gap-2 rounded-bouton border-2 border-ligne px-3 font-bold"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
        Menu
      </button>
      {open && (
        <nav ref={panelRef} id="menu-mobile" aria-label="Menu" className="absolute inset-x-0 top-18 z-40 border-b border-ligne bg-white shadow-carte">
          <ul className="mx-auto grid max-w-6xl gap-1 px-4 py-3">
            {[...links, ...accountLinks].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? 'page' : undefined}
                  className="flex min-h-12 items-center rounded-bouton px-3 font-bold hover:bg-papier aria-[current=page]:text-sapin-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
