'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { buttonClasses } from '@/components/button';
import { Field } from '@/components/form';

/** Saisie du code d'invitation dicté ou lu sur l'affiche de la structure. */
export function InvitationCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleaned.length < 6) {
      setError('Le code compte 8 caractères, des lettres et des chiffres.');
      return;
    }
    router.push(`/rejoindre/${cleaned}`);
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field
        label="Code d’invitation"
        hint="8 caractères, par exemple K7MP4XQ2. Les espaces et les tirets ne comptent pas."
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={error ?? undefined}
      />
      <div>
        <button type="submit" className={buttonClasses('primary')}>
          Continuer
        </button>
      </div>
    </form>
  );
}
