import Link from 'next/link';
import { site } from '@/lib/site';
import { buttonClasses } from './button';
import { AccountLink, MobileMenu, NavLink } from './header-menu';
import { Logo } from './logo';

const links = [
  { href: '/entrainement', label: 'Entraînement' },
  { href: '/examen-blanc', label: 'Examen blanc' },
  { href: '/fiches', label: 'Fiches' },
  { href: '/progression', label: 'Ma progression' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/associations', label: 'Associations' },
];

export function SiteHeader() {
  return (
    <header className="relative border-b border-ligne bg-white">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label={`${site.name}, retour à l’accueil`} className="rounded-md">
          <Logo />
        </Link>
        <nav aria-label="Navigation principale" className="flex items-center gap-5 text-petit">
          {links.slice(1).map((link) => (
            <NavLink key={link.href} {...link} />
          ))}
          <AccountLink />
          <Link href="/entrainement" className={buttonClasses('primary', 'min-h-11 px-4 text-petit max-sm:hidden')}>
            S’entraîner
          </Link>
          <MobileMenu links={links} />
        </nav>
      </div>
    </header>
  );
}
