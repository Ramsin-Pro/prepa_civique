import { apiGet } from '@/lib/api';
import { formatPrice } from '@/lib/labels';
import { ogContentType, ogImage, ogSize } from '@/lib/og';
import type { OrganizationOffer } from '@/lib/types';

export const alt = 'Offre associations et structures : préparer tout un groupe à l’examen civique';
export const size = ogSize;
export const contentType = ogContentType;
// Le prix vient de l'API : l'image est faite à la demande, jamais figée au moment du build.
export const dynamic = 'force-dynamic';

// Aperçu quand une association partage la page à une autre : le prix par personne se voit tout de suite.
export default async function Image() {
  const offer = await apiGet<OrganizationOffer>('/api/organizations/offer').catch(() => null);
  const prices = (offer?.plans ?? []).map((pack) => Math.round(pack.priceCents / pack.seats));
  const cheapest = prices.length > 0 ? Math.min(...prices) : null;
  return ogImage({
    eyebrow: 'Associations et structures',
    title: 'Préparez tout votre groupe à l’examen civique',
    subtitle:
      cheapest !== null
        ? `Dès ${formatPrice(cheapest).replace(/\s/g, ' ')} par personne pour 6 mois · Lien d’invitation · Suivi du groupe`
        : 'Lien d’invitation · Affiche à imprimer · Suivi du groupe',
  });
}
