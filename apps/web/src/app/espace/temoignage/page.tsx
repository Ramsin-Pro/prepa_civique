import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TestimonialForm } from '@/components/account/testimonial-form';
import { Eyebrow } from '@/components/eyebrow';
import { getMe } from '@/lib/api';

export const metadata: Metadata = { title: 'Donner mon avis', robots: { index: false } };
export const dynamic = 'force-dynamic';

// Témoignages authentiques (E01) : seules les personnes inscrites qui ont utilisé le site peuvent témoigner.
export default async function TestimonialPage() {
  if (!(await getMe())) redirect('/connexion?suite=/espace/temoignage');
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-petit">
        <Link href="/espace" className="text-sapin-700 underline underline-offset-4">
          ← Mon espace
        </Link>
      </p>
      <div className="mt-4">
        <Eyebrow>Votre avis</Eyebrow>
      </div>
      <h1 className="mt-2 text-[2.125rem] leading-tight">Racontez votre préparation</h1>
      <p className="mt-2 text-encre-doux">
        Votre témoignage aide d’autres personnes à se préparer. Il est relu par l’équipe avant d’être publié, et vous pouvez le retirer à
        tout moment.
      </p>
      <div className="mt-8 rounded-carte border border-ligne bg-white p-6 shadow-carte">
        <TestimonialForm />
      </div>
    </div>
  );
}
