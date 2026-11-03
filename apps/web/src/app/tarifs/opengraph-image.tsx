import { apiGet } from '@/lib/api';
import { formatPrice } from '@/lib/labels';
import { ogContentType, ogImage, ogSize } from '@/lib/og';
import type { Plan } from '@/lib/types';

export const alt = 'Tarifs : gratuit pour commencer, pass Premium sans abonnement, offre de groupe';
export const size = ogSize;
export const contentType = ogContentType;
// Le prix vient de l'API : l'image est faite à la demande, jamais figée au moment du build.
export const dynamic = 'force-dynamic';

export default async function Image() {
  const catalog = await apiGet<{ plans: Plan[] }>('/api/plans').catch(() => null);
  const pass = catalog?.plans[0];
  return ogImage({
    eyebrow: 'Tarifs',
    title: 'Gratuit pour commencer. Premium sans abonnement.',
    subtitle: pass
      ? `Pass ${Math.round(pass.durationDays / 30)} mois : ${formatPrice(pass.priceCents, pass.currency).replace(/\s/g, ' ')} TTC, payé une seule fois · Offre de groupe pour les associations`
      : 'Payé une seule fois, sans renouvellement automatique · Offre de groupe pour les associations',
  });
}
