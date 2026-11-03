import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentPageMetadata('cgu', 'Conditions générales d’utilisation');

export default function Page() {
  return <ContentPageView slug="cgu" eyebrow="Informations légales" />;
}
