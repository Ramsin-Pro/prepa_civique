'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { errorMessage, send } from '@/lib/client';
import type { Role } from '@/lib/types';

// Briques communes du back-office : données chargées depuis /api/admin, statuts, tableaux, pagination.

export const AdminRoleContext = createContext<Role>('READONLY');

export function AdminRoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <AdminRoleContext.Provider value={role}>{children}</AdminRoleContext.Provider>;
}

/** Droits de la personne connectée, pour n'afficher que les actions qu'elle peut faire (l'API vérifie de toute façon). */
export function useRights() {
  const role = useContext(AdminRoleContext);
  return {
    role,
    editContent: role === 'EDITOR' || role === 'SUPER_ADMIN',
    support: role === 'SUPPORT' || role === 'SUPER_ADMIN',
    superAdmin: role === 'SUPER_ADMIN',
  };
}

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setError(null);
    send<T>('GET', url)
      .then((result) => !cancelled && setData(result))
      .catch((caught) => !cancelled && setError(errorMessage(caught)));
    return () => {
      cancelled = true;
    };
  }, [url, version]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);
  return { data, error, loading: data === null && error === null, reload };
}

export type ContentStatus = 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Brouillon',
  IN_REVIEW: 'À relire',
  APPROVED: 'Validé',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
};

const STATUS_STYLES: Record<ContentStatus, string> = {
  DRAFT: 'bg-papier text-encre-doux border-ligne',
  IN_REVIEW: 'bg-ocre-100 text-ocre-700 border-ocre-100',
  APPROVED: 'bg-prune-100 text-prune-700 border-prune-100',
  PUBLISHED: 'bg-sapin-50 text-sapin-700 border-sapin-100',
  ARCHIVED: 'bg-white text-encre-doux border-ligne line-through',
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>;
}

/** Transitions proposées selon le statut (mêmes règles que l'API, apps/api/src/admin/workflow.ts). */
export const NEXT_STATUSES: Record<ContentStatus, { to: ContentStatus; label: string }[]> = {
  DRAFT: [
    { to: 'IN_REVIEW', label: 'Envoyer en relecture' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  IN_REVIEW: [
    { to: 'PUBLISHED', label: 'Valider et publier' },
    { to: 'APPROVED', label: 'Valider sans publier' },
    { to: 'DRAFT', label: 'Renvoyer en brouillon' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  APPROVED: [
    { to: 'PUBLISHED', label: 'Publier' },
    { to: 'IN_REVIEW', label: 'Remettre en relecture' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  PUBLISHED: [
    { to: 'IN_REVIEW', label: 'Retirer et remettre en relecture' },
    { to: 'ARCHIVED', label: 'Archiver' },
  ],
  ARCHIVED: [{ to: 'DRAFT', label: 'Restaurer en brouillon' }],
};

export function PageTitle({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.875rem] leading-tight">{title}</h1>
        {description && <div className="mt-1 max-w-3xl text-petit text-encre-doux">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-carte border border-ligne bg-white p-5 shadow-carte ${className}`}>
      {title && <h2 className="mb-3 font-texte text-[1.125rem] font-bold tracking-normal">{title}</h2>}
      {children}
    </section>
  );
}

export function Loading() {
  return (
    <p aria-live="polite" className="mt-6 text-encre-doux">
      Chargement…
    </p>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-4 rounded-carte border border-brique-200 bg-brique-100 p-4 text-petit">
      {message}
    </p>
  );
}

export function SuccessNotice({ message }: { message: string }) {
  return (
    <p role="status" className="mt-4 rounded-carte border border-sapin-100 bg-sapin-50 p-4 text-petit">
      {message}
    </p>
  );
}

export const tableClasses = 'w-full min-w-[40rem] border-collapse text-left text-petit';
export const thClasses = 'border-b border-ligne bg-papier px-3 py-2 font-bold';
export const tdClasses = 'border-b border-ligne px-3 py-2 align-top';

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="relative mt-4 overflow-x-auto rounded-carte border border-ligne bg-white">{children}</div>;
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-petit text-encre-doux">{total} élément{total > 1 ? 's' : ''}</p>;
  return (
    <nav aria-label="Pagination" className="mt-3 flex flex-wrap items-center gap-3 text-petit">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className={smallButton}>
        Précédent
      </button>
      <span>
        Page {page} sur {pages} · {total} éléments
      </span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className={smallButton}>
        Suivant
      </button>
    </nav>
  );
}

export const smallButton =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-bouton border-2 border-ligne bg-white px-3 text-petit font-bold hover:border-sapin-500 disabled:cursor-not-allowed disabled:opacity-50';
export const smallPrimary =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-bouton bg-sapin-700 px-3 text-petit font-bold text-white hover:bg-sapin-900 disabled:cursor-not-allowed disabled:opacity-50';
export const smallDanger =
  'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-bouton bg-brique-700 px-3 text-petit font-bold text-white hover:bg-[#8f3523] disabled:cursor-not-allowed disabled:opacity-50';

export const selectClasses = 'min-h-10 rounded-bouton border-2 border-ligne bg-white px-2 text-petit';
export const inputSmall = 'min-h-10 rounded-bouton border-2 border-ligne bg-white px-3 text-petit outline-none focus:border-sapin-500';
export const textareaClasses =
  'block w-full rounded-bouton border-2 border-ligne bg-white px-3 py-2 text-petit outline-none focus:border-sapin-500';

export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
export const formatMoney = (cents: number, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100);

/** Action d'écriture avec message de résultat : renvoie true si elle a réussi. */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<unknown>, message?: string) => {
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      if (message) setSuccess(message);
      return true;
    } catch (caught) {
      setError(errorMessage(caught));
      return false;
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, error, success, run, setError, setSuccess };
}
