'use client';

import { useState } from 'react';
import { buttonClasses } from '@/components/button';
import { FormAlert } from '@/components/form';
import { errorMessage, send } from '@/lib/client';

/** Arrête les rappels de révision depuis le lien de l'email. Un clic est demandé : les robots de messagerie ne le font pas. */
export function ReminderUnsubscribe({ token }: { token: string | undefined }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  if (!token) return <FormAlert>Ce lien est incomplet.</FormAlert>;
  if (state === 'done') return <FormAlert tone="success">C’est fait : vous ne recevrez plus de rappels de révision.</FormAlert>;

  async function stop() {
    setState('sending');
    try {
      await send('POST', '/api/account/reminders/unsubscribe', { token });
      setState('done');
    } catch (caught) {
      setError(errorMessage(caught));
      setState('idle');
    }
  }

  return (
    <div className="grid gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <button type="button" onClick={stop} disabled={state === 'sending'} className={buttonClasses('primary', 'w-full')}>
        Arrêter les rappels de révision
      </button>
      <p className="text-petit text-encre-doux">Vous pourrez les réactiver à tout moment dans votre compte.</p>
    </div>
  );
}
