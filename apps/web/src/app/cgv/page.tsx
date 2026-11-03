import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentPageMetadata('cgv', 'Conditions générales de vente');

export default function Page() {
  return <ContentPageView slug="cgv" eyebrow="Informations légales" />;
}
