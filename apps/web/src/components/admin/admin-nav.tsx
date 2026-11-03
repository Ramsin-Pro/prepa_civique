'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@/lib/types';

type Item = { href: string; label: string; roles?: Role[] };

const SUPPORT: Role[] = ['SUPPORT', 'SUPER_ADMIN'];

const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Pilotage', items: [{ href: '/admin', label: 'Tableau de bord' }, { href: '/admin/statistiques', label: 'Statistiques' }] },
  {
    title: 'Contenus',
    items: [
      { href: '/admin/questions', label: 'Questions' },
      { href: '/admin/signalements', label: 'Signalements' },
      { href: '/admin/temoignages', label: 'Témoignages' },
      { href: '/admin/fiches', label: 'Fiches de révision' },
      { href: '/admin/pages', label: 'Pages' },
      { href: '/admin/lexique', label: 'Lexique' },
      { href: '/admin/sources', label: 'Sources' },
      { href: '/admin/parcours', label: 'Parcours et thèmes' },
      { href: '/admin/examens', label: 'Examens blancs' },
    ],
  },
  {
    title: 'Clients',
    items: [
      { href: '/admin/utilisateurs', label: 'Utilisateurs', roles: SUPPORT },
      { href: '/admin/commandes', label: 'Commandes', roles: SUPPORT },
      { href: '/admin/associations', label: 'Associations', roles: SUPPORT },
      { href: '/admin/formules', label: 'Formules et accès', roles: SUPPORT },
      { href: '/admin/messages', label: 'Messages', roles: SUPPORT },
    ],
  },
  {
    title: 'Sécurité',
    items: [
      { href: '/admin/journal', label: 'Journal d’audit', roles: ['SUPER_ADMIN'] },
      { href: '/admin/securite', label: 'Double authentification' },
    ],
  },
];

const ROLE_LABELS: Record<Role, string> = {
  LEARNER: 'Apprenant',
  READONLY: 'Lecture seule',
  SUPPORT: 'Support',
  EDITOR: 'Éditeur',
  SUPER_ADMIN: 'Super-administrateur',
};

/** Navigation du back-office (A09) : seules les rubriques permises par le rôle apparaissent. */
export function AdminNav({ role, email }: { role: Role; email: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/admin' ? pathname === href : pathname.startsWith(href));

  return (
    <nav aria-label="Back-office" className="text-petit lg:sticky lg:top-6 lg:w-56 lg:flex-none lg:self-start">
      <p className="font-titre text-[1.25rem] font-semibold">Back-office</p>
      <p className="mt-1 truncate text-encre-doux" title={email}>
        {email}
      </p>
      <p className="mt-1 inline-flex rounded-md bg-sapin-50 px-2 py-0.5 text-xs font-bold text-sapin-700">{ROLE_LABELS[role]}</p>
      <div className="mt-5 flex gap-6 overflow-x-auto pb-2 lg:block lg:overflow-visible">
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.roles || item.roles.includes(role));
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="flex-none lg:mb-5">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-encre-doux">{group.title}</p>
              <ul className="mt-1.5 flex gap-1 lg:block">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className="block whitespace-nowrap rounded-md px-2 py-1.5 hover:bg-white aria-[current=page]:bg-white aria-[current=page]:font-bold aria-[current=page]:text-sapin-700 aria-[current=page]:shadow-carte"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <Link href="/" className="mt-2 inline-block text-sapin-700 underline underline-offset-4">
        ← Retour au site
      </Link>
    </nav>
  );
}
