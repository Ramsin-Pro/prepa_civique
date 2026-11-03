'use client';

import { useState, type FormEvent } from 'react';
import { send } from '@/lib/client';
import {
  Card,
  ErrorNotice,
  Loading,
  PageTitle,
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
} from '../ui';

type Check = { ok: boolean; error: { kind: string; needed: number; available: number; topicId: number | null } | null };

type Template = {
  id: number;
  pathId: number;
  version: number;
  knowledgeCount: number;
  situationCount: number;
  durationSeconds: number;
  passThreshold: number;
  regulatoryRef: string | null;
  active: boolean;
  createdAt: string;
  attempts: number;
  path: { slug: string; title: string; code: string };
  quotas: { id: number; topic: { slug: string; title: string }; kind: 'KNOWLEDGE' | 'SITUATION'; notion: string | null; count: number; publishedAvailable: number }[];
  check: { published: Check; visible: Check };
};

type QuotaDraft = { topicSlug: string; kind: 'KNOWLEDGE' | 'SITUATION'; notion: string; count: number };

const KIND = { KNOWLEDGE: 'Connaissance', SITUATION: 'Mise en situation' };

/** Modèles d'examen blanc (A04) : versions, répartition, essai à blanc, activation. */
export function ExamTemplatesAdmin() {
  const rights = useRights();
  const templates = useApi<Template[]>('/api/admin/exam-templates');
  const topics = useApi<{ topics: { slug: string; title: string }[] }>('/api/admin/questions/meta/options');
  const action = useAction();
  const [draftFrom, setDraftFrom] = useState<Template | null>(null);

  async function activate(template: Template) {
    if (!window.confirm(`Activer la version ${template.version} pour « ${template.path.title} » ? Les nouveaux examens blancs l’utiliseront.`)) return;
    if (await action.run(() => send('POST', `/api/admin/exam-templates/${template.id}/activate`), 'Modèle activé.')) templates.reload();
  }

  return (
    <>
      <PageTitle
        title="Examens blancs"
        description="Chaque modèle fixe le nombre de questions, la durée, le seuil et la répartition par thème. Une version déjà utilisée ne change jamais : on en crée une nouvelle."
      />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      {templates.error && <ErrorNotice message={templates.error} />}
      {!templates.data && !templates.error && <Loading />}

      <div className="mt-4 grid gap-4">
        {templates.data?.map((template) => (
          <Card key={template.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold">
                  {template.path.title} · version {template.version}{' '}
                  {template.active && <span className="ml-1 rounded-md bg-sapin-50 px-2 py-0.5 text-xs font-bold text-sapin-700">Active</span>}
                </p>
                <p className="text-petit text-encre-doux">
                  {template.knowledgeCount} connaissance + {template.situationCount} mises en situation · {Math.round(template.durationSeconds / 60)} min · seuil{' '}
                  {template.passThreshold}/{template.knowledgeCount + template.situationCount} · {template.attempts} examen(s) passé(s) · créée le{' '}
                  {formatDate(template.createdAt)}
                </p>
                {template.regulatoryRef && <p className="mt-1 text-xs text-encre-doux">{template.regulatoryRef}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {rights.editContent && (
                  <button type="button" onClick={() => setDraftFrom(template)} className={smallButton}>
                    Nouvelle version à partir de celle-ci
                  </button>
                )}
                {rights.superAdmin && !template.active && (
                  <button type="button" disabled={action.pending} onClick={() => activate(template)} className={smallPrimary}>
                    Activer
                  </button>
                )}
              </div>
            </div>
            <p className={`mt-3 rounded-md p-2 text-petit ${template.check.published.ok ? 'bg-sapin-50' : 'bg-brique-100'}`}>
              {template.check.published.ok
                ? 'Essai à blanc réussi avec les questions publiées : un examen complet peut être tiré.'
                : `Pas assez de questions publiées : ${template.check.published.error?.available} disponibles pour ${template.check.published.error?.needed} demandées.`}
              {!template.check.published.ok && template.check.visible.ok && ' (Possible en aperçu de développement, avec les questions à relire.)'}
            </p>
            {template.quotas.length > 0 && (
              <TableWrap>
                <table className={tableClasses}>
                  <thead>
                    <tr>
                      <th className={thClasses}>Thème</th>
                      <th className={thClasses}>Famille</th>
                      <th className={thClasses}>Notion</th>
                      <th className={thClasses}>Questions</th>
                      <th className={thClasses}>Publiées disponibles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.quotas.map((quota) => (
                      <tr key={quota.id}>
                        <td className={tdClasses}>{quota.topic.title}</td>
                        <td className={tdClasses}>{KIND[quota.kind]}</td>
                        <td className={tdClasses}>{quota.notion ?? 'toutes'}</td>
                        <td className={tdClasses}>{quota.count}</td>
                        <td className={`${tdClasses} ${quota.publishedAvailable < quota.count ? 'font-bold text-brique-700' : ''}`}>{quota.publishedAvailable}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        ))}
      </div>

      {draftFrom && (
        <NewVersionForm
          key={draftFrom.id}
          from={draftFrom}
          topics={topics.data?.topics ?? []}
          onCancel={() => setDraftFrom(null)}
          onCreated={() => {
            setDraftFrom(null);
            templates.reload();
          }}
        />
      )}
    </>
  );
}

function NewVersionForm({
  from,
  topics,
  onCancel,
  onCreated,
}: {
  from: Template;
  topics: { slug: string; title: string }[];
  onCancel: () => void;
  onCreated: () => void;
}) {
  const action = useAction();
  const [form, setForm] = useState({
    knowledgeCount: from.knowledgeCount,
    situationCount: from.situationCount,
    minutes: Math.round(from.durationSeconds / 60),
    passThreshold: from.passThreshold,
    regulatoryRef: from.regulatoryRef ?? '',
  });
  const [quotas, setQuotas] = useState<QuotaDraft[]>(
    from.quotas.map((quota) => ({ topicSlug: quota.topic.slug, kind: quota.kind, notion: quota.notion ?? '', count: quota.count })),
  );

  const totals = {
    KNOWLEDGE: quotas.filter((quota) => quota.kind === 'KNOWLEDGE').reduce((sum, quota) => sum + quota.count, 0),
    SITUATION: quotas.filter((quota) => quota.kind === 'SITUATION').reduce((sum, quota) => sum + quota.count, 0),
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const ok = await action.run(() =>
      send('POST', '/api/admin/exam-templates', {
        pathSlug: from.path.slug,
        knowledgeCount: form.knowledgeCount,
        situationCount: form.situationCount,
        durationSeconds: form.minutes * 60,
        passThreshold: form.passThreshold,
        regulatoryRef: form.regulatoryRef || null,
        quotas: quotas.map((quota) => ({ ...quota, notion: quota.notion || null })),
      }),
    );
    if (ok) onCreated();
  }

  const number = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((current) => ({ ...current, [key]: Number(event.target.value) }));

  return (
    <Card title={`Nouvelle version pour « ${from.path.title} »`} className="mt-6">
      <form onSubmit={submit} className="grid gap-4">
        {action.error && <ErrorNotice message={action.error} />}
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-petit font-bold">
            Connaissance
            <input type="number" min={1} value={form.knowledgeCount} onChange={number('knowledgeCount')} className={inputSmall} />
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Mises en situation
            <input type="number" min={0} value={form.situationCount} onChange={number('situationCount')} className={inputSmall} />
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Durée (minutes)
            <input type="number" min={1} value={form.minutes} onChange={number('minutes')} className={inputSmall} />
          </label>
          <label className="grid gap-1 text-petit font-bold">
            Seuil de réussite
            <input type="number" min={1} value={form.passThreshold} onChange={number('passThreshold')} className={inputSmall} />
          </label>
        </div>
        <label className="grid gap-1 text-petit font-bold">
          Référence réglementaire
          <input value={form.regulatoryRef} onChange={(event) => setForm((current) => ({ ...current, regulatoryRef: event.target.value }))} className={`${inputSmall} font-normal`} />
        </label>

        <fieldset className="grid gap-2">
          <legend className="text-petit font-bold">
            Répartition : {totals.KNOWLEDGE} / {form.knowledgeCount} connaissance, {totals.SITUATION} / {form.situationCount} mises en situation
          </legend>
          {quotas.map((quota, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_11rem_1fr_5rem_auto]">
              <select
                value={quota.topicSlug}
                aria-label="Thème"
                onChange={(event) => setQuotas(quotas.map((other, position) => (position === index ? { ...other, topicSlug: event.target.value } : other)))}
                className={selectClasses}
              >
                {topics.map((topic) => (
                  <option key={topic.slug} value={topic.slug}>
                    {topic.title}
                  </option>
                ))}
              </select>
              <select
                value={quota.kind}
                aria-label="Famille"
                onChange={(event) =>
                  setQuotas(quotas.map((other, position) => (position === index ? { ...other, kind: event.target.value as QuotaDraft['kind'] } : other)))
                }
                className={selectClasses}
              >
                <option value="KNOWLEDGE">Connaissance</option>
                <option value="SITUATION">Mise en situation</option>
              </select>
              <input
                value={quota.notion}
                placeholder="Notion (vide = toutes)"
                aria-label="Notion"
                onChange={(event) => setQuotas(quotas.map((other, position) => (position === index ? { ...other, notion: event.target.value } : other)))}
                className={inputSmall}
              />
              <input
                type="number"
                min={1}
                value={quota.count}
                aria-label="Nombre de questions"
                onChange={(event) => setQuotas(quotas.map((other, position) => (position === index ? { ...other, count: Number(event.target.value) } : other)))}
                className={inputSmall}
              />
              <button type="button" onClick={() => setQuotas(quotas.filter((_, position) => position !== index))} className={smallButton}>
                Retirer
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              onClick={() => setQuotas([...quotas, { topicSlug: topics[0]?.slug ?? '', kind: 'KNOWLEDGE', notion: '', count: 1 }])}
              className={smallButton}
            >
              Ajouter une ligne
            </button>
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button type="submit" disabled={action.pending} className={smallPrimary}>
            Créer la version (inactive)
          </button>
          <button type="button" onClick={onCancel} className={smallButton}>
            Annuler
          </button>
        </div>
      </form>
    </Card>
  );
}
