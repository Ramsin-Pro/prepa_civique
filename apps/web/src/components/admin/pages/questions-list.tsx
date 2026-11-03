'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { send } from '@/lib/client';
import { questionTypeLabel } from '@/lib/labels';
import type { QuestionType } from '@/lib/types';
import {
  ErrorNotice,
  Loading,
  NEXT_STATUSES,
  PageTitle,
  Pagination,
  STATUS_LABELS,
  StatusBadge,
  SuccessNotice,
  TableWrap,
  formatDate,
  inputSmall,
  selectClasses,
  smallButton,
  smallPrimary,
  tableClasses,
  tdClasses,
  thClasses,
  useAction,
  useApi,
  useRights,
  type ContentStatus,
} from '../ui';

type Item = {
  id: number;
  reference: string;
  type: QuestionType;
  status: ContentStatus;
  statement: string;
  notion: string | null;
  draftConfidence: string | null;
  verifiedAt: string | null;
  topic: { slug: string; title: string };
  openReports: number;
};

type ListResponse = { total: number; page: number; pageSize: number; byStatus: Partial<Record<ContentStatus, number>>; items: Item[] };
type Options = { topics: { slug: string; title: string }[]; paths: { slug: string; title: string }[] };

const CONFIDENCE: Record<string, string> = { high: 'élevée', medium: 'moyenne', low: 'faible' };

/** Questions (A03) : recherche, filtres, et relecture par lots pour aller vite sans rien publier par erreur. */
export function QuestionsList({ initialStatus }: { initialStatus?: string }) {
  const rights = useRights();
  const [filters, setFilters] = useState({ status: initialStatus ?? '', type: '', topic: '', confidence: '', reported: false, q: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const action = useAction();

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: '25' });
    if (filters.status) params.set('status', filters.status);
    if (filters.type) params.set('type', filters.type);
    if (filters.topic) params.set('topic', filters.topic);
    if (filters.confidence) params.set('confidence', filters.confidence);
    if (filters.reported) params.set('reported', 'true');
    if (filters.q) params.set('q', filters.q);
    return params.toString();
  }, [filters, page]);
  const list = useApi<ListResponse>(`/api/admin/questions?${query}`);
  const options = useApi<Options>('/api/admin/questions/meta/options');

  function update(patch: Partial<typeof filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
    setSelected(new Set());
  }

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulk(to: ContentStatus) {
    const ids = [...selected];
    await action.run(async () => {
      const result = await send<{ results: { id: number; ok: boolean; error?: string }[]; done: number }>('POST', '/api/admin/questions/bulk-transition', { ids, to });
      const refused = result.results.filter((entry) => !entry.ok);
      if (refused.length > 0) {
        throw new Error(`${result.done} question(s) passée(s) en « ${STATUS_LABELS[to]} ». ${refused.length} refusée(s) : ${refused[0]!.error}`);
      }
    }, `${ids.length} question(s) passée(s) en « ${STATUS_LABELS[to]} ».`);
    // Même en cas de refus partiel, une partie des questions a pu changer de statut.
    list.reload();
    setSelected(new Set());
  }

  const items = list.data?.items ?? [];
  const byStatus = list.data?.byStatus;
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const commonStatus = items.find((item) => selected.has(item.id))?.status;
  const bulkTargets = commonStatus && items.filter((item) => selected.has(item.id)).every((item) => item.status === commonStatus) ? NEXT_STATUSES[commonStatus] : [];

  return (
    <>
      <PageTitle
        title="Questions"
        description="Chaque question est relue par une autre personne que la dernière à l’avoir modifiée, puis publiée. Rien n’est visible des candidats sans relecture."
        actions={
          rights.editContent ? (
            <>
              <Link href="/admin/questions/import" className={smallButton}>
                Importer
              </Link>
              <Link href="/admin/questions/nouvelle" className={smallPrimary}>
                Nouvelle question
              </Link>
            </>
          ) : null
        }
      />

      {byStatus && (
        <p className="mt-4 flex flex-wrap gap-2 text-petit">
          {(Object.keys(STATUS_LABELS) as ContentStatus[]).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => update({ status: filters.status === status ? '' : status })}
              aria-pressed={filters.status === status}
              className="rounded-full border border-ligne bg-white px-3 py-1 aria-[pressed=true]:border-sapin-700 aria-[pressed=true]:font-bold"
            >
              {STATUS_LABELS[status]} · {byStatus[status] ?? 0}
            </button>
          ))}
        </p>
      )}

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: search.trim() });
        }}
        className="mt-4 flex flex-wrap items-end gap-2"
      >
        <label className="grid gap-1 text-petit">
          Recherche
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Référence ou texte" className={inputSmall} />
        </label>
        <label className="grid gap-1 text-petit">
          Thème
          <select value={filters.topic} onChange={(event) => update({ topic: event.target.value })} className={selectClasses}>
            <option value="">Tous</option>
            {options.data?.topics.map((topic) => (
              <option key={topic.slug} value={topic.slug}>
                {topic.title}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-petit">
          Type
          <select value={filters.type} onChange={(event) => update({ type: event.target.value })} className={selectClasses}>
            <option value="">Tous</option>
            {(Object.keys(questionTypeLabel) as QuestionType[]).map((type) => (
              <option key={type} value={type}>
                {questionTypeLabel[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-petit">
          Confiance du brouillon
          <select value={filters.confidence} onChange={(event) => update({ confidence: event.target.value })} className={selectClasses}>
            <option value="">Toutes</option>
            <option value="low">Faible (à relire en premier)</option>
            <option value="medium">Moyenne</option>
            <option value="high">Élevée</option>
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-petit">
          <input type="checkbox" checked={filters.reported} onChange={(event) => update({ reported: event.target.checked })} className="size-4 accent-sapin-700" />
          Signalées
        </label>
        <button type="submit" className={smallButton}>
          Rechercher
        </button>
      </form>

      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}

      {rights.editContent && selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-carte bg-sapin-50 p-3 text-petit">
          <strong>{selected.size} sélectionnée(s)</strong>
          {bulkTargets.length === 0 && <span>Sélectionnez des questions de même statut pour les traiter ensemble.</span>}
          {bulkTargets.map((target) => (
            <button key={target.to} type="button" disabled={action.pending} onClick={() => bulk(target.to)} className={target.to === 'PUBLISHED' ? smallPrimary : smallButton}>
              {target.label}
            </button>
          ))}
        </div>
      )}

      {list.error && <ErrorNotice message={list.error} />}
      {!list.data && !list.error && <Loading />}
      {list.data && (
        <>
          <TableWrap>
            <table className={tableClasses}>
              <thead>
                <tr>
                  {rights.editContent && (
                    <th className={thClasses}>
                      <input
                        type="checkbox"
                        aria-label="Tout sélectionner"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.id)))}
                        className="size-4 accent-sapin-700"
                      />
                    </th>
                  )}
                  <th className={thClasses}>Référence</th>
                  <th className={thClasses}>Énoncé</th>
                  <th className={thClasses}>Thème</th>
                  <th className={thClasses}>Statut</th>
                  <th className={thClasses}>Confiance</th>
                  <th className={thClasses}>Vérifiée</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-papier">
                    {rights.editContent && (
                      <td className={tdClasses}>
                        <input type="checkbox" aria-label={`Sélectionner ${item.reference}`} checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="size-4 accent-sapin-700" />
                      </td>
                    )}
                    <td className={`${tdClasses} whitespace-nowrap font-bold`}>
                      <Link href={`/admin/questions/${item.id}`} className="text-sapin-700 underline underline-offset-4">
                        {item.reference}
                      </Link>
                    </td>
                    <td className={tdClasses}>
                      <span className="line-clamp-2">{item.statement}</span>
                      <span className="text-xs text-encre-doux">
                        {questionTypeLabel[item.type]}
                        {item.notion && ` · ${item.notion}`}
                        {item.openReports > 0 && <strong className="text-brique-700"> · {item.openReports} signalement(s)</strong>}
                      </span>
                    </td>
                    <td className={tdClasses}>{item.topic.title}</td>
                    <td className={tdClasses}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className={tdClasses}>{item.draftConfidence ? CONFIDENCE[item.draftConfidence] : '—'}</td>
                    <td className={`${tdClasses} whitespace-nowrap`}>{formatDate(item.verifiedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
