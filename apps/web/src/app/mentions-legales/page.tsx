import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentPageMetadata('mentions-legales', 'Mentions légales');

export default function Page() {
  return <ContentPageView slug="mentions-legales" eyebrow="Informations légales" />;
}
