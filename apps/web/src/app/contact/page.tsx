import type { Metadata } from 'next';
import Link from 'next/link';
import { Eyebrow } from '@/components/eyebrow';
import { ContactForm } from '@/components/public/contact-form';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Contact', description: 'Une question sur le site, votre compte ou un paiement ? Écrivez-nous.', path: '/contact' });

export default function ContactPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <Eyebrow>Contact</Eyebrow>
        <h1 className="mt-2 text-[2.125rem] leading-tight">Une question ? Écrivez-nous</h1>
        <p className="mt-3 text-encre-doux">Nous répondons aux questions sur le site, votre compte, un paiement ou une erreur dans le contenu.</p>
        <div className="mt-6 rounded-carte bg-sapin-50 p-5">
          <p className="font-bold">Pour votre dossier, adressez-vous à l’administration.</p>
          <p className="mt-1 text-petit">
            Nous sommes une plateforme indépendante : nous ne pouvons pas répondre sur votre situation personnelle ni sur un titre de
            séjour. Consultez{' '}
            <a href="https://www.service-public.gouv.fr" target="_blank" rel="noopener noreferrer" className="text-sapin-700 underline underline-offset-4">
              service-public.gouv.fr
            </a>{' '}
            ou votre préfecture.
          </p>
        </div>
        <p className="mt-6 text-petit">
          Votre réponse est peut-être déjà dans les{' '}
          <Link href="/faq" className="text-sapin-700 underline underline-offset-4">
            questions fréquentes
          </Link>
          .
        </p>
      </div>
      <div className="rounded-carte border border-ligne bg-white p-6 shadow-carte sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
