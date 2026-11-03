import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PrintButton } from '@/components/account/print-button';
import { ApiError, apiGet } from '@/lib/api';
import { site } from '@/lib/site';
import type { InvitationPoster } from '@/lib/types';

export const metadata: Metadata = { title: 'Affiche d’invitation', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Affiche à imprimer pour la salle de formation : un QR code à scanner, le lien et le code en grand, avec les trois étapes.
export default async function InvitationPosterPage() {
  let poster: InvitationPoster;
  try {
    poster = await apiGet<InvitationPoster>('/api/organizations/mine/poster', { personal: true });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/connexion?suite=/espace/structure/affiche');
    if (error instanceof ApiError && error.status === 404) redirect('/espace/structure');
    throw error;
  }
  const joinPath = new URL(poster.inviteUrl).host + '/rejoindre';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 print:py-0">
      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <Link href="/espace/structure" className="text-sapin-700 underline underline-offset-4">
          ← Retour à ma structure
        </Link>
        <PrintButton />
      </div>
      <article className="rounded-carte border-2 border-encre bg-white p-6 text-center sm:p-10 print:border-0 print:p-0">
        <p className="text-[1.25rem] font-bold text-sapin-700">{site.name}</p>
        <h1 className="mt-4 text-[2.5rem] leading-tight">Préparez l’examen civique</h1>
        <p className="mt-3 text-[1.375rem]">{poster.name} vous offre l’accès complet, gratuitement.</p>
        <div className="mt-8 grid items-center gap-8 text-left sm:grid-cols-[13rem_1fr]">
          <figure className="mx-auto w-52 sm:w-full">
            {/* SVG produit par notre API à partir de notre propre lien d'invitation. */}
            <div className="[&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: poster.qrSvg }} />
            <figcaption className="mt-2 text-center text-petit text-encre-doux">Scannez avec l’appareil photo du téléphone</figcaption>
          </figure>
          <ol className="grid gap-4 text-[1.25rem]">
            <li>
              <strong>1.</strong> Scannez le code, ou ouvrez sur votre téléphone :
              <strong className="block break-all text-[1.125rem]">{poster.inviteUrl.replace(/^https?:\/\//, '')}</strong>
            </li>
            <li>
              <strong>2.</strong> Créez votre compte gratuit et confirmez votre email.
            </li>
            <li>
              <strong>3.</strong> Touchez « Activer ma place ».
            </li>
          </ol>
        </div>
        <p className="mt-10 text-[1.25rem]">Ou allez sur {joinPath} et entrez le code :</p>
        <p className="mt-3 font-titre text-[2.25rem] font-semibold tracking-[0.25em] sm:text-[4rem]">{poster.inviteCode}</p>
        <p className="mt-10 text-petit text-encre-doux">
          {site.name} est une plateforme indépendante, sans lien avec l’administration. C’est un entraînement : seul l’examen officiel donne
          l’attestation.
        </p>
      </article>
    </div>
  );
}
