import { ContentPageView, contentPageMetadata } from '@/components/content/content-page';

export const dynamic = 'force-dynamic';
export const generateMetadata = () => contentPageMetadata('cookies', 'Cookies');

export default function Page() {
  return <ContentPageView slug="cookies" eyebrow="Informations légales" />;
}
