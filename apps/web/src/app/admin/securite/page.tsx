import type { Metadata } from 'next';
import { MfaSetup } from '@/components/admin/mfa-setup';
import { getMe } from '@/lib/api';

export const metadata: Metadata = { title: 'Double authentification' };

export default async function SecurityPage() {
  const me = await getMe();
  return (
    <>
      <h1 className="text-[1.875rem] leading-tight">Double authentification</h1>
      <p className="mt-1 max-w-3xl text-petit text-encre-doux">
        Un code à 6 chiffres, généré par une application sur votre téléphone, protège l’accès au back-office même si votre mot de passe
        est découvert.
      </p>
      <div className="mt-6">
        <MfaSetup enabled={me?.mfa.enabled ?? false} required={me?.mfa.required ?? false} />
      </div>
    </>
  );
}
