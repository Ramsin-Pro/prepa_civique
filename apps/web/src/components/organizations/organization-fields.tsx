'use client';

import { useId } from 'react';
import { inputClasses } from '@/components/form';
import { organizationKindLabel } from '@/lib/labels';
import type { OrganizationKind } from '@/lib/types';

/** Liste déroulante de la charte, avec son libellé et son erreur. */
export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="font-bold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-erreur` : undefined}
        className={`${inputClasses} mt-1.5`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-erreur`} className="mt-1 text-petit font-bold text-brique-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function KindField({ kinds, value, onChange, error }: { kinds: OrganizationKind[]; value: string; onChange: (value: string) => void; error?: string }) {
  return (
    <SelectField
      label="Type de structure"
      value={value}
      onChange={onChange}
      options={kinds.map((kind) => ({ value: kind, label: organizationKindLabel[kind] ?? kind }))}
      error={error}
    />
  );
}

/** Lien d'invitation gardé dans le navigateur le temps de créer son compte et de confirmer son adresse. */
export const PENDING_INVITATION_KEY = 'repere:invitation';

export function rememberInvitation(code: string | null) {
  try {
    if (code) window.localStorage.setItem(PENDING_INVITATION_KEY, code);
    else window.localStorage.removeItem(PENDING_INVITATION_KEY);
  } catch {
    // Stockage indisponible (navigation privée) : la personne rouvrira simplement le lien.
  }
}

export function pendingInvitation(): string | null {
  try {
    return window.localStorage.getItem(PENDING_INVITATION_KEY);
  } catch {
    return null;
  }
}
