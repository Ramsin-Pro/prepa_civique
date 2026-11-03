import Link from 'next/link';
import { site } from '@/lib/site';
import { InfoIcon } from './icons';

// Liens du pied de page, rangés par besoin.
const groups = [
  {
    id: 'pied-preparer',
    title: 'Se préparer',
    links: [
      { href: '/entrainement', label: 'Entraînement' },
      { href: '/examen-blanc', label: 'Examen blanc' },
      { href: '/fiches', label: 'Fiches de révision' },
      { href: '/lexique', label: 'Lexique' },
      { href: '/orientation', label: 'Quel examen pour moi ?' },
    ],
  },
  {
    id: 'pied-offres',
    title: 'Offres',
    links: [
      { href: '/tarifs', label: 'Tarifs' },
      { href: '/associations', label: 'Associations et structures' },
      { href: '/rejoindre', label: 'J’ai un code de ma structure' },
    ],
  },
  {
    id: 'pied-aide',
    title: 'Aide',
    links: [
      { href: '/faq', label: 'Questions fréquentes' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

// Pages légales (§9) : publiées seulement après validation par un juriste.
const legalLinks = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgu', label: 'CGU' },
  { href: '/cgv', label: 'CGV' },
  { href: '/confidentialite', label: 'Confidentialité' },
  { href: '/cookies', label: 'Cookies' },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-sapin-900 text-[#e8efeb]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Bandeau d'indépendance, présent sur toutes les pages (cahier p. 2, E01) */}
        <div className="flex gap-3.5 rounded-carte border border-white/15 bg-white/5 p-5">
          <InfoIcon className="mt-0.5 size-6 flex-none text-ocre-100" />
          <p>
            <strong className="text-white">{site.name} est une plateforme indépendante.</strong> Elle n’a aucun lien avec
            l’administration française. Pour savoir si vous devez passer l’examen civique, consultez{' '}
            <a
              href="https://www.service-public.gouv.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline underline-offset-4"
            >
              service-public.gouv.fr
            </a>
            .
          </p>
        </div>
        <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((group) => (
            <nav key={group.id} aria-labelledby={group.id}>
              <h2 id={group.id} className="font-texte text-[0.8rem] font-bold uppercase tracking-[0.08em] text-ocre-100">
                {group.title}
              </h2>
              <ul className="mt-3 grid gap-2 text-petit">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-white underline-offset-4 hover:underline">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav aria-labelledby="pied-legal">
            <h2 id="pied-legal" className="font-texte text-[0.8rem] font-bold uppercase tracking-[0.08em] text-ocre-100">
              Informations légales
            </h2>
            <ul className="mt-3 grid gap-2 text-petit text-white/80">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="underline-offset-4 hover:text-white hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-8 border-t border-white/15 pt-6 text-petit text-white/70">
          {site.name} · {site.tagline} · Version de développement
        </p>
      </div>
    </footer>
  );
}
