import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/password-forms';
import { AuthCard } from '@/components/form';

export const metadata: Metadata = { title: 'Mot de passe oublié', robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Mot de passe oublié" intro={<p>Indiquez l’adresse email de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe.</p>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
