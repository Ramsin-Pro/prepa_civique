import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentPageMetadata('faq', 'Questions fréquentes');

export default function Page() {
  return <ContentPageView slug="faq" eyebrow="Aide" />;
}
