'use client';

import Link from 'next/link';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { send } from '@/lib/client';
import { formatPrice } from '@/lib/labels';
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

// ─── Sources (A03 : adresse, licence, date de consultation) ─────────────────

type Source = { id: number; key: string; label: string; url: string | null; licence: string | null; consultedAt: string | null; questionCount: number };

const sourcePayload = (form: FormData) => ({
  label: String(form.get('label')),
  url: String(form.get('url') ?? '') || null,
  licence: String(form.get('licence') ?? '') || null,
  consultedAt: String(form.get('consultedAt') ?? '') || null,
});

export function SourcesAdmin() {
  const rights = useRights();
  const sources = useApi<Source[]>('/api/admin/sources');
  const action = useAction();
  const [editing, setEditing] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (await action.run(() => send('POST', '/api/admin/sources', sourcePayload(new FormData(formElement))), 'Source ajoutée.')) {
      formElement.reset();
      sources.reload();
    }
  }

  async function update(event: FormEvent<HTMLFormElement>, id: number) {
    event.preventDefault();
    if (await action.run(() => send('PATCH', `/api/admin/sources/${id}`, sourcePayload(new FormData(event.currentTarget))), 'Source modifiée.')) {
      setEditing(null);
      sources.reload();
    }
  }

  const shown = (sources.data ?? []).filter((source) => `${source.label} ${source.url ?? ''}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <PageTitle
        title="Sources"
        description="Les textes et pages officielles qui justifient les réponses. Indiquez la licence et la date de consultation : elles s’affichent avec la correction."
      />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      {rights.editContent && (
        <Card title="Ajouter une source" className="mt-4">
          <SourceFields onSubmit={create} pending={action.pending} submitLabel="Ajouter" />
        </Card>
      )}
      <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrer" aria-label="Filtrer les sources" className={`${inputSmall} mt-4`} />
      {sources.error && <ErrorNotice message={sources.error} />}
      {!sources.data && !sources.error && <Loading />}
      <ul className="mt-4 grid gap-2">
        {shown.map((source) => (
          <li key={source.id} className="rounded-carte border border-ligne bg-white p-3 text-petit">
            {editing === source.id ? (
              <SourceFields source={source} onSubmit={(event) => update(event, source.id)} pending={action.pending} submitLabel="Enregistrer" onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{source.label}</p>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-sapin-700 underline underline-offset-4">
                      {source.url}
                    </a>
                  )}
                  <p className="text-encre-doux">
                    {source.licence ?? 'Licence non indiquée'} · consultée le {formatDate(source.consultedAt)} · {source.questionCount} question(s)
                  </p>
                </div>
                {rights.editContent && (
                  <button type="button" onClick={() => setEditing(source.id)} className={smallButton}>
                    Modifier
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function SourceFields({
  source,
  onSubmit,
  pending,
  submitLabel,
  onCancel,
}: {
  source?: Source;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending: boolean;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-2 sm:grid-cols-2">
      <label className="grid gap-1 text-petit font-bold sm:col-span-2">
        Libellé
        <input name="label" required minLength={3} defaultValue={source?.label} className={`${inputSmall} font-normal`} />
      </label>
      <label className="grid gap-1 text-petit font-bold">
        Adresse
        <input name="url" type="url" defaultValue={source?.url ?? ''} className={`${inputSmall} font-normal`} />
      </label>
      <label className="grid gap-1 text-petit font-bold">
        Licence
        <input name="licence" defaultValue={source?.licence ?? ''} placeholder="Licence Ouverte Etalab 2.0" className={`${inputSmall} font-normal`} />
      </label>
      <label className="grid gap-1 text-petit font-bold">
        Consultée le
        <input name="consultedAt" type="date" defaultValue={source?.consultedAt?.slice(0, 10) ?? ''} className={`${inputSmall} font-normal`} />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending} className={smallPrimary}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={smallButton}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Formules et accès Premium (A07) ─────────────────────────────────────────

type Plan = {
  id: number;
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  durationDays: number;
  active: boolean;
  position: number;
  paidOrders: number;
  audience: 'INDIVIDUAL' | 'ORGANIZATION';
  seats: number | null;
  activationDays: number | null;
};

type Expiring = { id: number; startsAt: string; expiresAt: string; orderId: string | null; user: { id: string; email: string } };

const planPayload = (form: FormData) => ({
  name: String(form.get('name')),
  description: String(form.get('description')),
  priceCents: Math.round(Number(String(form.get('price')).replace(',', '.')) * 100),
  durationDays: Number(form.get('durationDays')),
  active: form.get('active') === 'on',
  position: Number(form.get('position') ?? 0),
  // Pack de structure : nombre de places et délai pour les activer. Vide pour un pass individuel.
  audience: form.get('audience') === 'ORGANIZATION' ? ('ORGANIZATION' as const) : ('INDIVIDUAL' as const),
  seats: form.get('audience') === 'ORGANIZATION' ? Number(form.get('seats')) : null,
  activationDays: form.get('audience') === 'ORGANIZATION' ? Number(form.get('activationDays') || 365) : null,
});

export function PlansAdmin() {
  const rights = useRights();
  const plans = useApi<Plan[]>('/api/admin/plans');
  const expiring = useApi<Expiring[]>('/api/admin/entitlements?within=30');
  const action = useAction();

  async function save(event: FormEvent<HTMLFormElement>, plan: Plan) {
    event.preventDefault();
    const payload = planPayload(new FormData(event.currentTarget));
    if (payload.priceCents !== plan.priceCents && !window.confirm('Le nouveau prix s’appliquera aux commandes suivantes. Continuer ?')) return;
    if (await action.run(() => send('PATCH', `/api/admin/plans/${plan.id}`, payload), 'Formule enregistrée.')) plans.reload();
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (await action.run(() => send('POST', '/api/admin/plans', { ...planPayload(form), code: String(form.get('code')) }), 'Formule créée.')) {
      formElement.reset();
      plans.reload();
    }
  }

  return (
    <>
      <PageTitle
        title="Formules et accès"
        description="Pass individuels (page Tarifs) et packs de places pour les structures (page Associations) : prix TTC, durée, ouverture à la vente. Un changement de prix ne touche pas les commandes déjà passées."
      />
      {action.error && <ErrorNotice message={action.error} />}
      {action.success && <SuccessNotice message={action.success} />}
      {plans.error && <ErrorNotice message={plans.error} />}
      {!plans.data && !plans.error && <Loading />}
      <div className="mt-4 grid gap-4">
        {plans.data?.map((plan) => (
          <Card key={plan.id}>
            <p className="text-petit text-encre-doux">
              {plan.audience === 'ORGANIZATION' ? `Pack structure de ${plan.seats} places` : 'Pass individuel'} · {plan.code} · {plan.paidOrders}{' '}
              commande(s) payée(s) · prix actuel {formatPrice(plan.priceCents, plan.currency)} TTC
              {plan.audience === 'ORGANIZATION' && plan.seats ? ` (${formatPrice(Math.round(plan.priceCents / plan.seats), plan.currency)} par personne)` : ''}
            </p>
            <PlanFields plan={plan} readOnly={!rights.superAdmin} pending={action.pending} onSubmit={(event) => save(event, plan)} submitLabel="Enregistrer" />
          </Card>
        ))}
      </div>
      {rights.superAdmin && (
        <Card title="Nouvelle formule" className="mt-6">
          <PlanFields readOnly={false} pending={action.pending} onSubmit={create} submitLabel="Créer la formule" withCode />
        </Card>
      )}

      <h2 className="mt-10 font-texte text-[1.25rem] font-bold tracking-normal">Accès Premium qui se terminent dans les 30 jours</h2>
      {expiring.error && <ErrorNotice message={expiring.error} />}
      {expiring.data && expiring.data.length === 0 && <p className="mt-2 text-petit text-encre-doux">Aucun.</p>}
      {expiring.data && expiring.data.length > 0 && (
        <TableWrap>
          <table className={tableClasses}>
            <thead>
              <tr>
                <th className={thClasses}>Client</th>
                <th className={thClasses}>Début</th>
                <th className={thClasses}>Fin</th>
                <th className={thClasses}>Origine</th>
              </tr>
            </thead>
            <tbody>
              {expiring.data.map((entry) => (
                <tr key={entry.id}>
                  <td className={tdClasses}>
                    <Link href={`/admin/utilisateurs/${entry.user.id}`} className="text-sapin-700 underline underline-offset-4">
                      {entry.user.email}
                    </Link>
                  </td>
                  <td className={tdClasses}>{formatDate(entry.startsAt)}</td>
                  <td className={tdClasses}>{formatDate(entry.expiresAt)}</td>
                  <td className={tdClasses}>{entry.orderId ? 'Achat' : 'Offert'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}

function PlanFields({
  plan,
  readOnly,
  pending,
  onSubmit,
  submitLabel,
  withCode = false,
}: {
  plan?: Plan;
  readOnly: boolean;
  pending: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  withCode?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-2 grid gap-3">
      <fieldset disabled={readOnly || pending} className="grid min-w-0 gap-3 sm:grid-cols-4">
        {withCode && (
          <label className="grid gap-1 text-petit font-bold">
            Code
            <input name="code" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="pass-1-mois" className={`${inputSmall} font-normal`} />
          </label>
        )}
        <label className="grid gap-1 text-petit font-bold sm:col-span-2">
          Nom
          <input name="name" required defaultValue={plan?.name} className={`${inputSmall} font-normal`} />
        </label>
        <label className="grid gap-1 text-petit font-bold">
          Prix TTC (€)
          <input name="price" required inputMode="decimal" defaultValue={plan ? (plan.priceCents / 100).toFixed(2).replace('.', ',') : ''} className={`${inputSmall} font-normal`} />
        </label>
        <label className="grid gap-1 text-petit font-bold">
          Durée d’accès (jours)
          <input name="durationDays" type="number" min={1} required defaultValue={plan?.durationDays ?? 90} className={`${inputSmall} font-normal`} />
        </label>
        <label className="grid gap-1 text-petit font-bold">
          Public
          <select name="audience" defaultValue={plan?.audience ?? 'INDIVIDUAL'} className={`${selectClasses} font-normal`}>
            <option value="INDIVIDUAL">Particulier (pass)</option>
            <option value="ORGANIZATION">Structure (pack de places)</option>
          </select>
        </label>
        <label className="grid gap-1 text-petit font-bold">
          Places (packs)
          <input name="seats" type="number" min={2} defaultValue={plan?.seats ?? ''} className={`${inputSmall} font-normal`} />
        </label>
        <label className="grid gap-1 text-petit font-bold">
          Délai d’activation (jours)
          <input name="activationDays" type="number" min={7} defaultValue={plan?.activationDays ?? 365} className={`${inputSmall} font-normal`} />
        </label>
        <label className="grid gap-1 text-petit font-bold sm:col-span-4">
          Description affichée sur la page Tarifs ou Associations
          <textarea name="description" required minLength={10} defaultValue={plan?.description} rows={2} className="rounded-bouton border-2 border-ligne px-3 py-2 font-normal" />
        </label>
        <label className="grid gap-1 text-petit font-bold">
          Ordre
          <input name="position" type="number" min={0} defaultValue={plan?.position ?? 0} className={`${inputSmall} font-normal`} />
        </label>
        <label className="flex items-center gap-2 text-petit font-bold">
          <input type="checkbox" name="active" defaultChecked={plan?.active ?? false} className="size-4 accent-sapin-700" />
          En vente
        </label>
      </fieldset>
      {!readOnly && (
        <div>
          <button type="submit" disabled={pending} className={smallPrimary}>
            {submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

// ─── Import de questions (A03) ───────────────────────────────────────────────

type ImportResult = { imported: number; results: { reference: string; ok: boolean; error?: string }[] };
type Options = { topics: { slug: string; title: string }[]; paths: { slug: string; title: string }[] };

export function QuestionImport() {
  const options = useApi<Options>('/api/admin/questions/meta/options');
  const action = useAction();
  const [file, setFile] = useState<{ name: string; data: { topic?: string; questions?: unknown[]; situations?: unknown[] } } | null>(null);
  const [topic, setTopic] = useState('');
  const [pathSlugs, setPathSlugs] = useState<string[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function read(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    setResult(null);
    action.setError(null);
    if (!chosen) return;
    try {
      const data = JSON.parse(await chosen.text()) as { topic?: string; questions?: unknown[]; situations?: unknown[] };
      setFile({ name: chosen.name, data });
      if (data.topic) setTopic(data.topic);
    } catch {
      setFile(null);
      action.setError('Ce fichier n’est pas un JSON valide.');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    await action.run(async () => {
      setResult(
        await send<ImportResult>('POST', '/api/admin/questions/import', {
          topic,
          pathSlugs: pathSlugs.length > 0 ? pathSlugs : (options.data?.paths.slice(0, 1).map((path) => path.slug) ?? []),
          questions: file.data.questions ?? [],
          situations: file.data.situations ?? [],
        }),
      );
    });
  }

  const count = (file?.data.questions?.length ?? 0) + (file?.data.situations?.length ?? 0);

  return (
    <>
      <p className="text-petit">
        <Link href="/admin/questions" className="text-sapin-700 underline underline-offset-4">
          ← Questions
        </Link>
      </p>
      <PageTitle
        title="Importer des questions"
        description={
          <>
            Un fichier JSON au format des contenus (voir la charte éditoriale), la bonne réponse en premier. Les questions sont créées en
            brouillon et passent par la relecture. Les énoncés officiels ne s’importent pas ici : ils viennent de la liste officielle.
          </>
        }
      />
      {action.error && <ErrorNotice message={action.error} />}
      {options.error && <ErrorNotice message={options.error} />}
      <form onSubmit={submit} className="mt-6 grid max-w-2xl gap-4 rounded-carte border border-ligne bg-white p-5 shadow-carte">
        <label className="grid gap-1 text-petit font-bold">
          Fichier JSON
          <input type="file" accept="application/json,.json" onChange={read} className="text-petit font-normal" />
        </label>
        {file && <p className="text-petit text-encre-doux">{file.name} : {count} question(s) à importer.</p>}
        <label className="grid gap-1 text-petit font-bold">
          Thème
          <select value={topic} onChange={(event) => setTopic(event.target.value)} required className={`${inputSmall} font-normal`}>
            <option value="">Choisir un thème</option>
            {options.data?.topics.map((entry) => (
              <option key={entry.slug} value={entry.slug}>
                {entry.title}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="text-petit font-bold">Parcours</legend>
          <div className="mt-1 flex flex-wrap gap-4 text-petit">
            {options.data?.paths.map((path) => (
              <label key={path.slug} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={pathSlugs.includes(path.slug)}
                  onChange={(event) => setPathSlugs(event.target.checked ? [...pathSlugs, path.slug] : pathSlugs.filter((slug) => slug !== path.slug))}
                  className="size-4 accent-sapin-700"
                />
                {path.title}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <button type="submit" disabled={!file || !topic || count === 0 || action.pending} className={smallPrimary}>
            {action.pending ? 'Import…' : 'Importer en brouillon'}
          </button>
        </div>
      </form>
      {result && (
        <Card title={`${result.imported} question(s) importée(s)`} className="mt-6">
          <ul className="grid gap-1 text-petit">
            {result.results.map((entry, index) => (
              <li key={`${entry.reference}-${index}`} className={entry.ok ? 'text-sapin-700' : 'text-brique-700'}>
                {entry.reference} : {entry.ok ? 'importée' : entry.error}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
