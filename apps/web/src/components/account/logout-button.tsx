'use client';

import { useState } from 'react';
import { buttonClasses } from '@/components/button';
import { send } from '@/lib/client';

export function LogoutButton({ className = '' }: { className?: string }) {
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await send('POST', '/api/auth/logout').catch(() => undefined);
    // Sur un appareil partagé : on efface l'invitation et les séries en cours, on garde la vitesse de lecture.
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('repere:') && key !== 'repere:vitesse-lecture') localStorage.removeItem(key);
      }
    } catch {
      // Stockage indisponible (navigation privée stricte) : rien à effacer.
    }
    window.location.assign('/');
  }

  return (
    <button type="button" onClick={logout} disabled={leaving} className={buttonClasses('secondary', className)}>
      {leaving ? 'Déconnexion…' : 'Se déconnecter'}
    </button>
  );
}
