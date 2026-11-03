import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentPageMetadata('confidentialite', 'Politique de confidentialité');

export default function Page() {
  return <ContentPageView slug="confidentialite" eyebrow="Informations légales" />;
}
