'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { send } from '@/lib/client';
import { questionTypeLabel } from '@/lib/labels';
import type { QuestionType } from '@/lib/types';
import { MobilePreview } from '../mobile-preview';
import {
  Card,
  ErrorNotice,
  Loading,
  NEXT_STATUSES,
  PageTitle,
  StatusBadge,
  SuccessNotice,
  formatDate,
  formatDateTime,
  inputSmall,
  selectClasses,
  smallButton,
  smallPrimary,
  textareaClasses,
  useAction,
  useApi,
  useRights,
  type ContentStatus,
} from '../ui';

type Options = {
  topics: { slug: string; title: string }[];
  paths: { slug: string; title: string; code: string }[];
  sources: { id: number; label: string; url: string | null }[];
  notions: { topic: string; notion: string | null }[];
};

type Detail = {
  id: number;
  reference: string;
  type: QuestionType;
  status: ContentStatus;
  statement: string;
  explanation: string;
  difficulty: number;
  notion: string | null;
  version: number;
  verifiedAt: string | null;
  author: string | null;
  draftConfidence: string | null;
  reviewNote: string | null;
  publishedAt: string | null;
  updatedAt: string;
  topic: { id: number; slug: string; title: string };
  paths: { slug: string; title: string; code: string }[];
  statementSource: { label: string; url: string | null } | null;
  answerSource: { id: number; label: string; url: string | null } | null;
  answers: { id: number; text: string; isCorrect: boolean; position: number }[];
  lastEditedBy: { email: string } | null;
  reviewedBy: { email: string } | null;
  versions: { id: number; version: number; snapshot: Record<string, unknown>; createdAt: string; editor: { email: string } | null }[];
  reports: { id: number; reason: string; message: string | null; status: string; createdAt: string }[];
  stats: { learners: number; attempts: number; correct: number };
};

type FormState = {
  type: QuestionType;
  statement: string;
  answers: { text: string; isCorrect: boolean }[];
  explanation: string;
  topicSlug: string;
  notion: string;
  pathSlugs: string[];
  answerSourceId: number | null;
  difficulty: number;
  reviewNote: string;
};

const REPORT_REASONS: Record<string, string> = {
  WRONG_ANSWER: 'Réponse fausse',
  UNCLEAR_STATEMENT: 'Question pas claire',
  WRONG_SOURCE: 'Source incorrecte',
  OTHER: 'Autre',
};

const emptyForm = (options: Options): FormState => ({
  type: 'ORIGINAL_KNOWLEDGE',
  statement: '',
  answers: [0, 1, 2, 3].map((index) => ({ text: '', isCorrect: index === 0 })),
  explanation: '',
  topicSlug: options.topics[0]?.slug ?? '',
  notion: '',
  pathSlugs: options.paths[0] ? [options.paths[0].slug] : [],
  answerSourceId: null,
  difficulty: 1,
  reviewNote: '',
});

const formOf = (question: Detail): FormState => ({
  type: question.type,
  statement: question.statement,
  answers: question.answers.map(({ text, isCorrect }) => ({ text, isCorrect })),
  explanation: question.explanation,
  topicSlug: question.topic.slug,
  notion: question.notion ?? '',
  pathSlugs: question.paths.map((path) => path.slug),
  answerSourceId: question.answerSource?.id ?? null,
  difficulty: question.difficulty,
  reviewNote: question.reviewNote ?? '',
});

/** Création d'une question d'entraînement ou d'une mise en situation (toujours en brouillon). */
export function QuestionCreate() {
  const options = useApi<Options>('/api/admin/questions/meta/options');
  const router = useRouter();
  const action = useAction();
  if (options.error) return <ErrorNotice message={options.error} />;
  if (!options.data) return <Loading />;

  async function create(form: FormState) {
    let id = 0;
    const ok = await action.run(async () => {
      ({ id } = await send<{ id: number }>('POST', '/api/admin/questions', {
        ...form,
        notion: form.notion || null,
        reviewNote: form.reviewNote || null,
      }));
    });
    if (ok) router.push(`/admin/questions/${id}`);
  }

  return (
    <>
      <PageTitle title="Nouvelle question" description="Elle est créée en brouillon. Une autre personne devra la relire avant sa publication." />
      {action.error && <ErrorNotice message={action.error} />}
      <QuestionForm options={options.data} initial={emptyForm(options.data)} creating pending={action.pending} onSubmit={create} />
    </>
  );
}

/** Fiche d'une question (A03) : édition versionnée, relecture, historique, signalements et résultats. */
export function QuestionEditor({ id }: { id: number }) {
  const rights = useRights();
  const router = useRouter();
  const question = useApi<Detail>(`/api/admin/questions/${id}`);
  const options = useApi<Options>('/api/admin/questions/meta/options');
  const action = useAction();
  const [note, setNote] = useState('');

  if (question.error) return <ErrorNotice message={question.error} />;
  if (!question.data || !options.data) return <Loading />;
  const data = question.data;

  async function save(form: FormState) {
    // Même règle que l'API : tout ce que lit le candidat (énoncé, propositions, bonne réponse, explication, source) est relu.
    const answersChanged = form.answers.some(
      (answer, index) => answer.text.trim() !== data.answers[index]?.text || answer.isCorrect !== data.answers[index]?.isCorrect,
    );
    const statementChanged = form.statement.trim() !== data.statement;
    const explanationChanged = form.explanation.trim() !== data.explanation;
    const sourceChanged = form.answerSourceId !== (data.answerSource?.id ?? null);
    const substantive = answersChanged || statementChanged || explanationChanged || sourceChanged;
    if (substantive && (data.status === 'PUBLISHED' || data.status === 'APPROVED')) {
      const confirmed = window.confirm(
        'Ce changement de fond renvoie la question en relecture : elle disparaîtra des entraînements jusqu’à sa nouvelle validation. Continuer ?',
      );
      if (!confirmed) return;
    }
    const ok = await action.run(
      () =>
        send('PATCH', `/api/admin/questions/${id}`, {
          version: data.version,
          ...(data.type === 'OFFICIAL_KNOWLEDGE' ? {} : { statement: form.statement }),
          answers: form.answers,
          explanation: form.explanation,
          topicSlug: form.topicSlug,
          notion: form.notion || null,
          pathSlugs: form.pathSlugs,
          answerSourceId: form.answerSourceId,
          difficulty: form.difficulty,
          reviewNote: form.reviewNote || null,
        }),
      'Modifications enregistrées. L’ancienne version est gardée dans l’historique.',
    );
    if (ok) question.reload();
  }

  async function transition(to: ContentStatus) {
    const ok = await action.run(
      () => send('POST', `/api/admin/questions/${id}/transition`, { to, note: note.trim() || undefined }),
      'Statut mis à jour.',
    );
    if (ok) {
      setNote('');
      question.reload();
    }
  }

  async function duplicate() {
    let copyId = 0;
    const ok = await action.run(async () => {
      ({ id: copyId } = await send<{ id: number }>('POST', `/api/admin/questions/${id}/duplicate`));
    });
    if (ok) router.push(`/admin/questions/${copyId}`);
  }

  const successRate = data.stats.attempts > 0 ? Math.round((data.stats.correct / data.stats.attempts) * 100) : null;

  return (
    <>
      <p className="text-petit">
        <Link href="/admin/questions" className="text-sapin-700 underline underline-offset-4">
          ← Questions
        </Link>
      </p>
      <PageTitle
        title={data.reference}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={data.status} /> {questionTypeLabel[data.type]} · version {data.version} · modifiée le {formatDateTime(data.updatedAt)}
            {data.lastEditedBy && ` par ${data.lastEditedBy.email}`}
          </span>
        }
        actions={
          rights.editContent ? (
            <button type="button" onClick={duplicate} disabled={action.pending} className={smallButton}>
              Dupliquer
            </button>
          ) : null
        }
      />

      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <QuestionForm
          key={data.version}
          options={options.data}
          initial={formOf(data)}
          officialStatement={data.type === 'OFFICIAL_KNOWLEDGE'}
          readOnly={!rights.editContent}
          pending={action.pending}
          onSubmit={save}
        />

        <div className="grid content-start gap-4">
          <Card title="Relecture">
            <dl className="grid gap-1 text-petit">
              <div>
                <dt className="inline text-encre-doux">Vérifiée le : </dt>
                <dd className="inline">{formatDate(data.verifiedAt)}</dd>
              </div>
              <div>
                <dt className="inline text-encre-doux">Par : </dt>
                <dd className="inline">{data.reviewedBy?.email ?? '—'}</dd>
              </div>
              <div>
                <dt className="inline text-encre-doux">Brouillon : </dt>
                <dd className="inline">{data.author ?? '—'}</dd>
              </div>
            </dl>
            {rights.editContent && (
              <div className="mt-4 grid gap-2">
                <label className="grid gap-1 text-petit">
                  Note de relecture (facultative)
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} className={textareaClasses} />
                </label>
                {NEXT_STATUSES[data.status].map((target) => (
                  <button
                    key={target.to}
                    type="button"
                    disabled={action.pending}
                    onClick={() => transition(target.to)}
                    className={target.to === 'PUBLISHED' ? smallPrimary : smallButton}
                  >
                    {target.label}
                  </button>
                ))}
                <p className="text-xs text-encre-doux">La validation doit venir d’une autre personne que la dernière à avoir modifié la question.</p>
              </div>
            )}
          </Card>

          <Card title="Résultats des candidats">
            <p className="text-petit">
              {data.stats.attempts > 0
                ? `${successRate} % de bonnes réponses sur ${data.stats.attempts} réponses (${data.stats.learners} personnes).`
                : 'Pas encore de réponse.'}
            </p>
          </Card>

          <Card title={`Signalements (${data.reports.length})`}>
            {data.reports.length === 0 ? (
              <p className="text-petit text-encre-doux">Aucun signalement.</p>
            ) : (
              <ul className="grid gap-2 text-petit">
                {data.reports.map((report) => (
                  <li key={report.id} className="rounded-md bg-papier p-2">
                    <strong>{REPORT_REASONS[report.reason] ?? report.reason}</strong> · {formatDate(report.createdAt)} · {report.status === 'OPEN' ? 'ouvert' : 'traité'}
                    {report.message && <p className="mt-1">{report.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Historique des versions">
            {data.versions.length === 0 ? (
              <p className="text-petit text-encre-doux">Aucune modification depuis l’import.</p>
            ) : (
              <ul className="grid gap-2 text-petit">
                {data.versions.map((version) => (
                  <li key={version.id}>
                    <details>
                      <summary className="cursor-pointer">
                        Version {version.version} · {formatDateTime(version.createdAt)}
                        {version.editor && ` · avant modification par ${version.editor.email}`}
                      </summary>
                      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-papier p-2 text-xs">{JSON.stringify(version.snapshot, null, 2)}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function QuestionForm({
  options,
  initial,
  creating = false,
  officialStatement = false,
  readOnly = false,
  pending,
  onSubmit,
}: {
  options: Options;
  initial: FormState;
  creating?: boolean;
  officialStatement?: boolean;
  readOnly?: boolean;
  pending: boolean;
  onSubmit: (form: FormState) => void;
}) {
  // Le formulaire repart de la question enregistrée quand sa version change (clé du composant).
  const [form, setForm] = useState(initial);
  const set = (patch: Partial<FormState>) => setForm((current) => ({ ...current, ...patch }));
  const notions = options.notions.filter((entry) => entry.topic === form.topicSlug && entry.notion).map((entry) => entry.notion!);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="grid content-start gap-5 rounded-carte border border-ligne bg-white p-5 shadow-carte">
      <fieldset disabled={readOnly || pending} className="grid min-w-0 gap-5">
        {creating && (
          <label className="grid gap-1 text-petit font-bold">
            Type
            <select value={form.type} onChange={(event) => set({ type: event.target.value as QuestionType })} className={selectClasses}>
              <option value="ORIGINAL_KNOWLEDGE">{questionTypeLabel.ORIGINAL_KNOWLEDGE}</option>
              <option value="ORIGINAL_SITUATION">{questionTypeLabel.ORIGINAL_SITUATION}</option>
            </select>
          </label>
        )}
        <label className="grid gap-1 text-petit font-bold">
          Énoncé
          <textarea
            value={form.statement}
            onChange={(event) => set({ statement: event.target.value })}
            rows={3}
            readOnly={officialStatement}
            required
            className={`${textareaClasses} text-courant font-normal ${officialStatement ? 'bg-papier' : ''}`}
          />
          {officialStatement && <span className="font-normal text-encre-doux">Énoncé officiel repris mot pour mot : il ne se modifie pas.</span>}
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-petit font-bold">Propositions (cochez la bonne réponse)</legend>
          {form.answers.map((answer, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="radio"
                name="bonne-reponse"
                aria-label={`La proposition ${index + 1} est la bonne réponse`}
                checked={answer.isCorrect}
                onChange={() => set({ answers: form.answers.map((other, position) => ({ ...other, isCorrect: position === index })) })}
                className="size-5 flex-none accent-sapin-700"
              />
              <input
                value={answer.text}
                aria-label={`Proposition ${index + 1}`}
                onChange={(event) => set({ answers: form.answers.map((other, position) => (position === index ? { ...other, text: event.target.value } : other)) })}
                required
                className={`${inputSmall} w-full text-courant ${answer.isCorrect ? 'border-sapin-500' : ''}`}
              />
            </div>
          ))}
        </fieldset>

        <label className="grid gap-1 text-petit font-bold">
          Explication (affichée après la réponse)
          <textarea value={form.explanation} onChange={(event) => set({ explanation: event.target.value })} rows={5} required className={`${textareaClasses} font-normal`} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-petit font-bold">
            Thème
            <select value={form.topicSlug} onChange={(event) => set({ topicSlug: event.target.value, notion: '' })} className={selectClasses}>
              {options.topics.map((topic) => (
                <option key={topic.slug} value={topic.slug}>
                  {topic.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Notion de l’arrêté
            <input list="notions" value={form.notion} onChange={(event) => set({ notion: event.target.value })} className={`${inputSmall} font-normal`} />
            <datalist id="notions">
              {notions.map((notion) => (
                <option key={notion} value={notion} />
              ))}
            </datalist>
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Source de la réponse
            <select
              value={form.answerSourceId ?? ''}
              onChange={(event) => set({ answerSourceId: event.target.value ? Number(event.target.value) : null })}
              className={selectClasses}
            >
              <option value="">Aucune</option>
              {options.sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Difficulté
            <select value={form.difficulty} onChange={(event) => set({ difficulty: Number(event.target.value) })} className={selectClasses}>
              <option value={1}>1 · facile</option>
              <option value={2}>2 · moyenne</option>
              <option value={3}>3 · difficile</option>
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="text-petit font-bold">Parcours</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-petit">
            {options.paths.map((path) => (
              <label key={path.slug} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.pathSlugs.includes(path.slug)}
                  onChange={(event) =>
                    set({ pathSlugs: event.target.checked ? [...form.pathSlugs, path.slug] : form.pathSlugs.filter((slug) => slug !== path.slug) })
                  }
                  className="size-4 accent-sapin-700"
                />
                {path.title}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="grid gap-1 text-petit font-bold">
          Note pour la relecture (non publiée)
          <textarea value={form.reviewNote} onChange={(event) => set({ reviewNote: event.target.value })} rows={3} className={`${textareaClasses} font-normal`} />
        </label>
      </fieldset>
      {!readOnly && (
        <div>
          <button type="submit" disabled={pending} className={smallPrimary}>
            {creating ? 'Créer le brouillon' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}
      <details className="border-t border-ligne pt-4">
        <summary className="cursor-pointer text-petit font-bold text-sapin-700">Aperçu sur téléphone</summary>
        <div className="mt-4">
          <MobilePreview question={form} />
        </div>
      </details>
    </form>
  );
}
