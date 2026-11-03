import { site } from './site';
import type { QuestionType } from './types';

/** Étiquette affichée sur chaque question : une question officielle et une question rédigée ne se confondent jamais (§7). */
export const questionTypeLabel: Record<QuestionType, string> = {
  OFFICIAL_KNOWLEDGE: 'Question officielle',
  ORIGINAL_KNOWLEDGE: `Question d’entraînement · rédigée par ${site.name}`,
  ORIGINAL_SITUATION: `Mise en situation · rédigée par ${site.name}`,
};

/** Couleur de chaque parcours, reprise partout sur le site. */
export const pathStyle: Record<string, { stripe: string; badge: string }> = {
  CSP: { stripe: 'border-t-sapin-700', badge: 'bg-sapin-50 text-sapin-700' },
  CR: { stripe: 'border-t-ocre-500', badge: 'bg-ocre-100 text-ocre-700' },
  NAT: { stripe: 'border-t-prune-700', badge: 'bg-prune-100 text-prune-700' },
};

export const defaultPathStyle = { stripe: 'border-t-sapin-700', badge: 'bg-sapin-50 text-sapin-700' };

export const organizationKindLabel: Record<string, string> = {
  association: 'Association',
  'centre-social': 'Centre social',
  formation: 'Organisme de formation',
  collectivite: 'Collectivité',
  autre: 'Autre structure',
};

/** En français, le premier jour du mois s'écrit « 1er » : « 1er mai 2027 », pas « 1 mai 2027 ». */
export const withFirstOfMonth = (text: string) => text.replace(/(^|\s)1(\s)(?=\p{L})/u, '$11er$2');

/** Comme `new Intl.DateTimeFormat('fr-FR', options)`, avec « 1er » pour le premier jour du mois. */
export function frenchDateFormat(options: Intl.DateTimeFormatOptions) {
  const format = new Intl.DateTimeFormat('fr-FR', options);
  return { format: (date?: Date | number) => withFirstOfMonth(format.format(date)) };
}

export function formatDate(iso: string): string {
  return withFirstOfMonth(new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** Prix TTC lisible : « 19 € », ou « 19,90 € » quand il y a des centimes. */
export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
}
