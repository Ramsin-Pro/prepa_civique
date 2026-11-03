'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { send } from '@/lib/client';
import {
  Card,
  ErrorNotice,
  Loading,
  NEXT_STATUSES,
  PageTitle,
  StatusBadge,
  SuccessNotice,
  TableWrap,
  formatDate,
  formatDateTime,
  inputSmall,
  selectClasses,
  smallButton,
  smallDanger,
  smallPrimary,
  tableClasses,
  tdClasses,
  textareaClasses,
  thClasses,
  useAction,
  useApi,
  useRights,
  type ContentStatus,
} from '../ui';

// ─── Signalements (E08 → A01) ────────────────────────────────────────────────

type Report = {
  id: number;
  reason: string;
  message: string | null;
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  createdAt: string;
  question: { id: number; reference: string; statement: string; status: ContentStatus };
};

const REASONS: Record<string, string> = {
  WRONG_ANSWER: 'Réponse fausse',
  UNCLEAR_STATEMENT: 'Question pas claire',
  WRONG_SOURCE: 'Source incorrecte',
  OTHER: 'Autre',
};

export function ReportsAdmin() {
  const rights = useRights();
  const [status, setStatus] = useState<Report['status']>('OPEN');
  const reports = useApi<Report[]>(`/api/admin/reports?status=${status}`);
  const action = useAction();

  async function close(id: number, next: Report['status']) {
    if (await action.run(() => send('PATCH', `/api/admin/reports/${id}`, { status: next }))) reports.reload();
  }

  return (
    <>
      <PageTitle title="Signalements" description="Les erreurs signalées par les candidats. Corrigez la question, puis marquez le signalement comme traité." />
      <label className="mt-4 flex items-center gap-2 text-petit">
        Afficher
        <select value={status} onChange={(event) => setStatus(event.target.value as Report['status'])} className={selectClasses}>
          <option value="OPEN">Ouverts</option>
          <option value="RESOLVED">Traités</option>
          <option value="REJECTED">Rejetés</option>
        </select>
      </label>
      {action.error && <ErrorNotice message={action.error} />}
      {reports.error && <ErrorNotice message={reports.error} />}
      {!reports.data && !reports.error && <Loading />}
      {reports.data && reports.data.length === 0 && <p className="mt-6 text-encre-doux">Aucun signalement.</p>}
      <ul className="mt-4 grid gap-3">
        {reports.data?.map((report) => (
          <li key={report.id} className="rounded-carte border border-ligne bg-white p-4 shadow-carte">
            <div className="flex flex-wrap items-center justify-between gap-2 text-petit">
              <span>
                <strong>{REASONS[report.reason] ?? report.reason}</strong> · {formatDateTime(report.createdAt)} ·{' '}
                <Link href={`/admin/questions/${report.question.id}`} className="font-bold text-sapin-700 underline underline-offset-4">
                  {report.question.reference}
                </Link>{' '}
                <StatusBadge status={report.question.status} />
              </span>
              {rights.editContent && report.status === 'OPEN' && (
                <span className="flex gap-2">
                  <button type="button" disabled={action.pending} onClick={() => close(report.id, 'RESOLVED')} className={smallPrimary}>
                    Traité
                  </button>
                  <button type="button" disabled={action.pending} onClick={() => close(report.id, 'REJECTED')} className={smallButton}>
                    Rejeter
                  </button>
                </span>
              )}
            </div>
            <p className="mt-2">{report.question.statement}</p>
            {report.message && <p className="mt-2 rounded-md bg-papier p-2 text-petit">«&nbsp;{report.message}&nbsp;»</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

// ─── Fiches de révision (A05) ────────────────────────────────────────────────

type SheetRow = {
  id: number;
  slug: string;
  title: string;
  notion: string | null;
  status: ContentStatus;
  draftConfidence: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  topic: { slug: string; title: string };
};

export function SheetsAdmin() {
  const sheets = useApi<SheetRow[]>('/api/admin/sheets');
  return (
    <>
      <PageTitle title="Fiches de révision" description="Une fiche par notion de l’arrêté. Une fiche n’est visible qu’une fois validée et publiée." />
      {sheets.error && <ErrorNotice message={sheets.error} />}
      {!sheets.data && !sheets.error && <Loading />}
      {sheets.data && (
        <TableWrap>
          <table className={tableClasses}>
            <thead>
              <tr>
                <th className={thClasses}>Fiche</th>
                <th className={thClasses}>Thème</th>
                <th className={thClasses}>Statut</th>
                <th className={thClasses}>Validée le</th>
                <th className={thClasses}>Publiée le</th>
                <th className={thClasses}>Modifiée le</th>
              </tr>
            </thead>
            <tbody>
              {sheets.data.map((sheet) => (
                <tr key={sheet.id} className="hover:bg-papier">
                  <td className={tdClasses}>
                    <Link href={`/admin/fiches/${sheet.id}`} className="font-bold text-sapin-700 underline underline-offset-4">
                      {sheet.title}
                    </Link>
                    <span className="block text-xs text-encre-doux">{sheet.notion ?? sheet.slug}</span>
                  </td>
                  <td className={tdClasses}>{sheet.topic.title}</td>
                  <td className={tdClasses}>
                    <StatusBadge status={sheet.status} />
                  </td>
                  <td className={tdClasses}>{formatDate(sheet.reviewedAt)}</td>
                  <td className={tdClasses}>{formatDate(sheet.publishedAt)}</td>
                  <td className={tdClasses}>{formatDate(sheet.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

type SheetDetail = SheetRow & {
  summary: string;
  position: number;
  keyPoints: string[];
  examples: string[];
  vocabulary: { term: string; definition: string }[];
  sources: { label: string; url: string }[];
  reviewNote: string | null;
  reviewedByName: string | null;
};

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

/** Une ligne « terme : définition » ou « libellé | adresse » devient un objet ; les lignes mal formées sont ignorées. */
const pairs = (text: string, separator: string) =>
  lines(text).flatMap((line) => {
    const index = line.indexOf(separator);
    return index > 0 ? [[line.slice(0, index).trim(), line.slice(index + separator.length).trim()] as const] : [];
  });

export function SheetEditor({ id }: { id: number }) {
  const rights = useRights();
  const sheet = useApi<SheetDetail>(`/api/admin/sheets/${id}`);
  const action = useAction();
  const [reviewerName, setReviewerName] = useState('');

  if (sheet.error) return <ErrorNotice message={sheet.error} />;
  if (!sheet.data) return <Loading />;
  const data = sheet.data;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '');
    const ok = await action.run(
      () =>
        send('PATCH', `/api/admin/sheets/${id}`, {
          title: text('title'),
          summary: text('summary'),
          notion: text('notion') || null,
          keyPoints: lines(text('keyPoints')),
          examples: lines(text('examples')),
          vocabulary: pairs(text('vocabulary'), ':').map(([term, definition]) => ({ term, definition })),
          sources: pairs(text('sources'), '|').map(([label, url]) => ({ label, url })),
          reviewNote: text('reviewNote') || null,
        }),
      'Fiche enregistrée.',
    );
    if (ok) sheet.reload();
  }

  async function transition(to: ContentStatus) {
    const ok = await action.run(
      () => send('POST', `/api/admin/sheets/${id}/transition`, { to, reviewerName: reviewerName.trim() || undefined }),
      'Statut mis à jour.',
    );
    if (ok) sheet.reload();
  }

  return (
    <>
      <p className="text-petit">
        <Link href="/admin/fiches" className="text-sapin-700 underline underline-offset-4">
          ← Fiches de révision
        </Link>
      </p>
      <PageTitle
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} /> {data.topic.title} · modifiée le {formatDateTime(data.updatedAt)}
            {data.status === 'PUBLISHED' && (
              <Link href={`/fiches/${data.slug}`} className="text-sapin-700 underline underline-offset-4">
                Voir sur le site
              </Link>
            )}
          </span>
        }
      />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <form key={data.updatedAt} onSubmit={save} className="grid content-start gap-4 rounded-carte border border-ligne bg-white p-5 shadow-carte">
          <fieldset disabled={!rights.editContent || action.pending} className="grid min-w-0 gap-4">
            <Text name="title" label="Titre" defaultValue={data.title} />
            <Area name="summary" label="Résumé" defaultValue={data.summary} rows={4} />
            <Text name="notion" label="Notion de l’arrêté" defaultValue={data.notion ?? ''} />
            <Area name="keyPoints" label="Points clés (un par ligne)" defaultValue={data.keyPoints.join('\n')} rows={8} />
            <Area name="examples" label="Exemples (un par ligne)" defaultValue={data.examples.join('\n')} rows={4} />
            <Area
              name="vocabulary"
              label="Vocabulaire (une ligne « mot : définition »)"
              defaultValue={data.vocabulary.map((entry) => `${entry.term} : ${entry.definition}`).join('\n')}
              rows={5}
            />
            <Area
              name="sources"
              label="Sources (une ligne « libellé | adresse »)"
              defaultValue={data.sources.map((source) => `${source.label} | ${source.url}`).join('\n')}
              rows={4}
            />
            <Area name="reviewNote" label="Note pour la relecture (non publiée)" defaultValue={data.reviewNote ?? ''} rows={5} />
          </fieldset>
          {rights.editContent && (
            <div>
              <button type="submit" disabled={action.pending} className={smallPrimary}>
                Enregistrer
              </button>
            </div>
          )}
        </form>

        <Card title="Relecture" className="content-start self-start">
          <p className="text-petit">
            Validée le {formatDate(data.reviewedAt)}
            {data.reviewedByName && ` par ${data.reviewedByName}`}
          </p>
          {rights.editContent && (
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1 text-petit">
                Nom affiché comme responsable de la validation
                <input value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} placeholder={data.reviewedByName ?? 'Équipe éditoriale'} className={inputSmall} />
              </label>
              {NEXT_STATUSES[data.status].map((target) => (
                <button key={target.to} type="button" disabled={action.pending} onClick={() => transition(target.to)} className={target.to === 'PUBLISHED' ? smallPrimary : smallButton}>
                  {target.label}
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Text({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <label className="grid gap-1 text-petit font-bold">
      {label}
      <input name={name} defaultValue={defaultValue} className={`${inputSmall} font-normal`} />
    </label>
  );
}

function Area({ name, label, defaultValue, rows }: { name: string; label: string; defaultValue: string; rows: number }) {
  return (
    <label className="grid gap-1 text-petit font-bold">
      {label}
      <textarea name={name} defaultValue={defaultValue} rows={rows} className={`${textareaClasses} font-normal`} />
    </label>
  );
}

// ─── Pages (A05) ─────────────────────────────────────────────────────────────

type PageRow = { id: number; slug: string; title: string; status: ContentStatus; reviewedAt: string | null; publishedAt: string | null; updatedAt: string };

export function PagesAdmin() {
  const pages = useApi<PageRow[]>('/api/admin/pages');
  return (
    <>
      <PageTitle title="Pages" description="FAQ et pages légales, en Markdown. Les pages légales doivent être validées par un juriste avant leur publication." />
      {pages.error && <ErrorNotice message={pages.error} />}
      {!pages.data && !pages.error && <Loading />}
      {pages.data && (
        <TableWrap>
          <table className={tableClasses}>
            <thead>
              <tr>
                <th className={thClasses}>Page</th>
                <th className={thClasses}>Adresse</th>
                <th className={thClasses}>Statut</th>
                <th className={thClasses}>Validée le</th>
                <th className={thClasses}>Publiée le</th>
                <th className={thClasses}>Modifiée le</th>
              </tr>
            </thead>
            <tbody>
              {pages.data.map((page) => (
                <tr key={page.id} className="hover:bg-papier">
                  <td className={tdClasses}>
                    <Link href={`/admin/pages/${page.id}`} className="font-bold text-sapin-700 underline underline-offset-4">
                      {page.title}
                    </Link>
                  </td>
                  <td className={tdClasses}>/{page.slug}</td>
                  <td className={tdClasses}>
                    <StatusBadge status={page.status} />
                  </td>
                  <td className={tdClasses}>{formatDate(page.reviewedAt)}</td>
                  <td className={tdClasses}>{formatDate(page.publishedAt)}</td>
                  <td className={tdClasses}>{formatDate(page.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

type PageDetail = PageRow & { body: string };

export function PageEditor({ id }: { id: number }) {
  const rights = useRights();
  const page = useApi<PageDetail>(`/api/admin/pages/${id}`);
  const action = useAction();

  if (page.error) return <ErrorNotice message={page.error} />;
  if (!page.data) return <Loading />;
  const data = page.data;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () => send('PATCH', `/api/admin/pages/${id}`, { title: String(form.get('title')), body: String(form.get('body')) }),
      'Page enregistrée.',
    );
    if (ok) page.reload();
  }

  async function transition(to: ContentStatus) {
    if (await action.run(() => send('POST', `/api/admin/pages/${id}/transition`, { to }), 'Statut mis à jour.')) page.reload();
  }

  return (
    <>
      <p className="text-petit">
        <Link href="/admin/pages" className="text-sapin-700 underline underline-offset-4">
          ← Pages
        </Link>
      </p>
      <PageTitle
        title={data.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} /> /{data.slug} · modifiée le {formatDateTime(data.updatedAt)}
            <Link href={`/${data.slug}`} className="text-sapin-700 underline underline-offset-4">
              Voir sur le site
            </Link>
          </span>
        }
        actions={
          rights.editContent
            ? NEXT_STATUSES[data.status].map((target) => (
                <button key={target.to} type="button" disabled={action.pending} onClick={() => transition(target.to)} className={target.to === 'PUBLISHED' ? smallPrimary : smallButton}>
                  {target.label}
                </button>
              ))
            : null
        }
      />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      <form key={data.updatedAt} onSubmit={save} className="mt-6 grid gap-4 rounded-carte border border-ligne bg-white p-5 shadow-carte">
        <fieldset disabled={!rights.editContent || action.pending} className="grid min-w-0 gap-4">
          <Text name="title" label="Titre" defaultValue={data.title} />
          <label className="grid gap-1 text-petit font-bold">
            Contenu (Markdown : ## titre, ### sous-titre, - liste, [lien](adresse))
            <textarea name="body" defaultValue={data.body} rows={28} className={`${textareaClasses} font-mono font-normal`} />
          </label>
        </fieldset>
        {rights.editContent && (
          <div>
            <button type="submit" disabled={action.pending} className={smallPrimary}>
              Enregistrer
            </button>
          </div>
        )}
      </form>
    </>
  );
}

// ─── Lexique ─────────────────────────────────────────────────────────────────

type Term = { id: number; term: string; definition: string };

export function GlossaryAdmin() {
  const rights = useRights();
  const terms = useApi<Term[]>('/api/admin/glossary');
  const action = useAction();
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<number | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await action.run(
      () => send('POST', '/api/admin/glossary', { term: String(form.get('term')), definition: String(form.get('definition')) }),
      'Mot ajouté.',
    );
    if (ok) {
      formElement.reset();
      terms.reload();
    }
  }

  async function update(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () => send('PATCH', `/api/admin/glossary/${id}`, { term: String(form.get('term')), definition: String(form.get('definition')) }),
      'Mot modifié.',
    );
    if (ok) {
      setEditing(null);
      terms.reload();
    }
  }

  async function remove(term: Term) {
    if (!window.confirm(`Supprimer « ${term.term} » du lexique ?`)) return;
    if (await action.run(() => send('DELETE', `/api/admin/glossary/${term.id}`), 'Mot supprimé.')) terms.reload();
  }

  const shown = (terms.data ?? []).filter((term) => term.term.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageTitle title="Lexique" description="Les mots difficiles expliqués simplement. Ils apparaissent à côté des questions qui les contiennent." />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      {rights.editContent && (
        <form onSubmit={create} className="mt-4 grid gap-2 rounded-carte border border-ligne bg-white p-4 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-petit font-bold">
            Mot
            <input name="term" required className={`${inputSmall} font-normal`} />
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Définition simple
            <input name="definition" required className={`${inputSmall} font-normal`} />
          </label>
          <button type="submit" disabled={action.pending} className={smallPrimary}>
            Ajouter
          </button>
        </form>
      )}
      <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrer" aria-label="Filtrer le lexique" className={`${inputSmall} mt-4`} />
      {terms.error && <ErrorNotice message={terms.error} />}
      {!terms.data && !terms.error && <Loading />}
      <ul className="mt-4 grid gap-2">
        {shown.map((term) => (
          <li key={term.id} className="rounded-carte border border-ligne bg-white p-3 text-petit">
            {editing === term.id ? (
              <form onSubmit={(event) => update(event, term.id)} className="grid gap-2 sm:grid-cols-[12rem_1fr_auto_auto] sm:items-center">
                <input name="term" defaultValue={term.term} aria-label="Mot" className={inputSmall} />
                <input name="definition" defaultValue={term.definition} aria-label="Définition" className={inputSmall} />
                <button type="submit" className={smallPrimary}>
                  Enregistrer
                </button>
                <button type="button" onClick={() => setEditing(null)} className={smallButton}>
                  Annuler
                </button>
              </form>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p>
                  <strong>{term.term}</strong> : {term.definition}
                </p>
                {rights.editContent && (
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setEditing(term.id)} className={smallButton}>
                      Modifier
                    </button>
                    <button type="button" onClick={() => remove(term)} className={smallDanger}>
                      Supprimer
                    </button>
                  </span>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ─── Parcours et thèmes (A02) ────────────────────────────────────────────────

type PathsResponse = {
  paths: {
    id: number;
    code: string;
    slug: string;
    title: string;
    description: string;
    active: boolean;
    position: number;
    sources: { label: string; url: string }[];
    verifiedAt: string | null;
    questionCount: number;
    learnerCount: number;
    activeExamVersion: number | null;
  }[];
  topics: { id: number; slug: string; title: string; position: number; questionCount: number; sheetCount: number }[];
};

export function PathsAdmin() {
  const rights = useRights();
  const data = useApi<PathsResponse>('/api/admin/paths');
  const action = useAction();

  async function savePath(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () =>
        send('PATCH', `/api/admin/paths/${id}`, {
          title: String(form.get('title')),
          description: String(form.get('description')),
          active: form.get('active') === 'on',
          sources: pairs(String(form.get('sources') ?? ''), '|').map(([label, url]) => ({ label, url })),
          verifiedAt: String(form.get('verifiedAt') ?? '') || null,
        }),
      'Parcours enregistré.',
    );
    if (ok) data.reload();
  }

  async function createTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const ok = await action.run(
      () => send('POST', '/api/admin/topics', { slug: String(form.get('slug')), title: String(form.get('title')), position: Number(form.get('position')) }),
      'Thème créé.',
    );
    if (ok) {
      formElement.reset();
      data.reload();
    }
  }

  async function saveTopic(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ok = await action.run(
      () => send('PATCH', `/api/admin/topics/${id}`, { title: String(form.get('title')), position: Number(form.get('position')) }),
      'Thème enregistré.',
    );
    if (ok) data.reload();
  }

  return (
    <>
      <PageTitle title="Parcours et thèmes" description="Un parcours ouvert apparaît sur le site. N’ouvrez un parcours que lorsque ses questions sont publiées." />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      {data.error && <ErrorNotice message={data.error} />}
      {!data.data && !data.error && <Loading />}
      <div className="mt-4 grid gap-4">
        {data.data?.paths.map((path) => (
          <Card key={path.id}>
            <form onSubmit={(event) => savePath(event, path.id)} className="grid gap-3">
              <fieldset disabled={!rights.editContent || action.pending} className="grid min-w-0 gap-3">
                <p className="text-petit text-encre-doux">
                  {path.code} · /{path.slug} · {path.questionCount} questions · {path.learnerCount} comptes · examen blanc :{' '}
                  {path.activeExamVersion ? `version ${path.activeExamVersion}` : 'aucun modèle actif'}
                </p>
                <Text name="title" label="Titre" defaultValue={path.title} />
                <Area name="description" label="Description" defaultValue={path.description} rows={2} />
                <Area
                  name="sources"
                  label="Sources officielles affichées sur la page du parcours (une ligne « libellé | adresse »)"
                  defaultValue={path.sources.map((source) => `${source.label} | ${source.url}`).join('\n')}
                  rows={4}
                />
                <label className="grid gap-1 text-petit font-bold">
                  Règles vérifiées le
                  <input type="date" name="verifiedAt" defaultValue={path.verifiedAt?.slice(0, 10) ?? ''} className={`${inputSmall} w-48 font-normal`} />
                </label>
                <label className="flex items-center gap-2 text-petit font-bold">
                  <input type="checkbox" name="active" defaultChecked={path.active} className="size-4 accent-sapin-700" />
                  Parcours ouvert sur le site
                </label>
              </fieldset>
              {rights.editContent && (
                <div>
                  <button type="submit" disabled={action.pending} className={smallPrimary}>
                    Enregistrer
                  </button>
                </div>
              )}
            </form>
          </Card>
        ))}
      </div>
      <h2 className="mt-8 font-texte text-[1.25rem] font-bold tracking-normal">Thèmes</h2>
      {rights.editContent && (
        <form onSubmit={createTopic} className="mt-3 grid gap-2 rounded-carte border border-dashed border-ligne bg-white p-3 sm:grid-cols-[5rem_12rem_1fr_auto] sm:items-end">
          <label className="grid gap-1 text-petit">
            Ordre
            <input name="position" type="number" min={0} defaultValue={(data.data?.topics.length ?? 0) + 1} className={inputSmall} />
          </label>
          <label className="grid gap-1 text-petit">
            Adresse
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="nouveau-theme" className={inputSmall} />
          </label>
          <label className="grid gap-1 text-petit">
            Titre
            <input name="title" required minLength={3} className={inputSmall} />
          </label>
          <button type="submit" disabled={action.pending} className={smallPrimary}>
            Créer le thème
          </button>
        </form>
      )}
      <div className="mt-3 grid gap-2">
        {data.data?.topics.map((topic) => (
          <form key={topic.id} onSubmit={(event) => saveTopic(event, topic.id)} className="grid gap-2 rounded-carte border border-ligne bg-white p-3 sm:grid-cols-[5rem_1fr_auto_auto] sm:items-center">
            <input name="position" type="number" min={0} defaultValue={topic.position} aria-label="Ordre" disabled={!rights.editContent} className={inputSmall} />
            <input name="title" defaultValue={topic.title} aria-label="Titre du thème" disabled={!rights.editContent} className={inputSmall} />
            <span className="text-petit text-encre-doux">
              {topic.questionCount} questions · {topic.sheetCount} fiches
            </span>
            {rights.editContent && (
              <button type="submit" disabled={action.pending} className={smallButton}>
                Enregistrer
              </button>
            )}
          </form>
        ))}
      </div>
    </>
  );
}

// ─── Témoignages (E01) : modération avant publication ───────────────────────

type TestimonialRow = {
  id: number;
  displayName: string;
  text: string;
  pathCode: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  consentAt: string;
  updatedAt: string;
  user: { id: string };
};

export function TestimonialsAdmin() {
  const rights = useRights();
  const [status, setStatus] = useState<TestimonialRow['status']>('PENDING');
  const testimonials = useApi<TestimonialRow[]>(`/api/admin/testimonials?status=${status}`);
  const action = useAction();

  async function decide(id: number, next: 'APPROVED' | 'REJECTED') {
    if (await action.run(() => send('PATCH', `/api/admin/testimonials/${id}`, { status: next }))) testimonials.reload();
  }

  return (
    <>
      <PageTitle
        title="Témoignages"
        description="Rédigés par des personnes inscrites qui ont utilisé le site, avec leur accord. Publiez seulement ce qui est authentique, sans promesse de réussite ni information personnelle."
      />
      <label className="mt-4 flex items-center gap-2 text-petit">
        Afficher
        <select value={status} onChange={(event) => setStatus(event.target.value as TestimonialRow['status'])} className={selectClasses}>
          <option value="PENDING">À relire</option>
          <option value="APPROVED">Publiés</option>
          <option value="REJECTED">Refusés</option>
        </select>
      </label>
      {action.error && <ErrorNotice message={action.error} />}
      {testimonials.error && <ErrorNotice message={testimonials.error} />}
      {!testimonials.data && !testimonials.error && <Loading />}
      {testimonials.data?.length === 0 && <p className="mt-6 text-encre-doux">Aucun témoignage.</p>}
      <ul className="mt-4 grid gap-3">
        {testimonials.data?.map((testimonial) => (
          <li key={testimonial.id} className="rounded-carte border border-ligne bg-white p-4 shadow-carte">
            <p>«&nbsp;{testimonial.text}&nbsp;»</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-petit">
              <span className="text-encre-doux">
                <strong className="text-encre">{testimonial.displayName}</strong>
                {testimonial.pathCode && ` · ${testimonial.pathCode}`} · accord donné le {formatDateTime(testimonial.consentAt)}
              </span>
              {rights.editContent && (
                <span className="flex gap-2">
                  {testimonial.status !== 'APPROVED' && (
                    <button type="button" disabled={action.pending} onClick={() => decide(testimonial.id, 'APPROVED')} className={smallPrimary}>
                      Publier
                    </button>
                  )}
                  {testimonial.status !== 'REJECTED' && (
                    <button type="button" disabled={action.pending} onClick={() => decide(testimonial.id, 'REJECTED')} className={smallButton}>
                      Refuser
                    </button>
                  )}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

