'use client';

import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';

// Champs de formulaire de la charte : libellé visible au-dessus, aide et erreur reliées au champ.

export const inputClasses =
  'block min-h-12 w-full rounded-bouton border-2 border-ligne bg-white px-3.5 text-courant text-encre outline-none transition-colors placeholder:text-encre-doux/60 focus:border-sapin-500 aria-[invalid=true]:border-brique-700';

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string };

/** Libellé, aide et erreur autour d'un champ, avec les liens d'accessibilité. */
function FieldFrame({
  fieldId,
  label,
  hint,
  error,
  children,
}: {
  fieldId: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: (describedBy: string | undefined) => ReactNode;
}) {
  const describedBy = [hint ? `${fieldId}-aide` : null, error ? `${fieldId}-erreur` : null].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={fieldId} className="font-bold">
        {label}
      </label>
      {hint && (
        <p id={`${fieldId}-aide`} className="mt-0.5 text-petit text-encre-doux">
          {hint}
        </p>
      )}
      <div className="relative mt-1.5">{children(describedBy)}</div>
      {error && (
        <p id={`${fieldId}-erreur`} className="mt-1 text-petit font-bold text-brique-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Field({ label, hint, error, id, ...input }: FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldFrame fieldId={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <input id={fieldId} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={inputClasses} {...input} />
      )}
    </FieldFrame>
  );
}

/** Mot de passe avec un bouton pour l'afficher : on tape plus sûrement quand on voit ce qu'on écrit. */
export function PasswordField({ label, hint, error, id, ...input }: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = useState(false);
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldFrame fieldId={fieldId} label={label} hint={hint} error={error}>
      {(describedBy) => (
        <>
          <input
            id={fieldId}
            type={visible ? 'text' : 'password'}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${inputClasses} pr-24`}
            {...input}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-controls={fieldId}
            aria-pressed={visible}
            className="absolute inset-y-0 right-1.5 my-auto h-9 rounded-md px-2.5 text-petit font-bold text-sapin-700 hover:underline"
          >
            {visible ? 'Masquer' : 'Afficher'}
          </button>
        </>
      )}
    </FieldFrame>
  );
}

export function Checkbox({
  children,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { children: ReactNode; error?: string }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erreur` : undefined}
          className="mt-1 size-5 flex-none accent-sapin-700"
          {...input}
        />
        <label htmlFor={id} className="text-petit leading-relaxed">
          {children}
        </label>
      </div>
      {error && (
        <p id={`${id}-erreur`} className="ml-8 mt-1 text-petit font-bold text-brique-700">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Message d'un formulaire. Avec `reveal`, il est amené à l'écran dès qu'il apparaît : utile quand il remplace un
 * long formulaire ou s'affiche en haut pendant que la personne est en bas, près du bouton d'envoi.
 */
export function FormAlert({
  children,
  tone = 'error',
  reveal = false,
}: {
  children: ReactNode;
  tone?: 'error' | 'success' | 'info';
  reveal?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reveal) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [reveal]);
  const styles = {
    error: 'border-brique-200 bg-brique-100',
    success: 'border-sapin-100 bg-sapin-50',
    info: 'border-ocre-100 bg-ocre-100/50',
  };
  return (
    <div ref={ref} role={tone === 'error' ? 'alert' : 'status'} className={`scroll-my-6 rounded-carte border p-4 ${styles[tone]}`}>
      {children}
    </div>
  );
}

/** Carte centrée des pages de compte (inscription, connexion…). */
export function AuthCard({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="rounded-carte border border-ligne bg-white p-6 shadow-carte sm:p-8">
        <h1 className="text-[1.875rem] leading-tight">{title}</h1>
        {intro && <div className="mt-2 text-encre-doux">{intro}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
