'use client';

import { buttonClasses } from '@/components/button';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={buttonClasses('secondary', 'print:hidden')}>
      Imprimer ou enregistrer en PDF
    </button>
  );
}
